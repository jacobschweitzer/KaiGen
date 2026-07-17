<?php
/**
 * Image generation service for KaiGen.
 *
 * @package KaiGen
 */

namespace KaiGen;

use WP_Error;

/**
 * Coordinates WordPress AI Client image generation and media upload.
 */
final class Image_Generation_Service {
	/**
	 * Default timeout for Core AI image generation requests, in seconds.
	 *
	 * @var int
	 */
	private const IMAGE_GENERATION_TIMEOUT = 180;

	/**
	 * Handles an image generation request through the WordPress AI Client.
	 *
	 * @param \WP_REST_Request $request The request object.
	 * @return \WP_REST_Response|WP_Error The response or error.
	 */
	public function generate_from_request( $request ) {
		$prompt      = trim( (string) $request->get_param( 'prompt' ) );
		$provider    = sanitize_key( (string) $request->get_param( 'provider' ) );
		$orientation = $this->sanitize_orientation( $request->get_param( 'orientation' ) );

		if ( '' === $prompt ) {
			return new WP_Error( 'missing_prompt', __( 'Prompt is required.', 'kaigen' ), [ 'status' => 400 ] );
		}

		/**
		 * Filters a generated image result before KaiGen calls the WordPress AI Client.
		 *
		 * Returning a non-null value short-circuits the provider request while preserving
		 * KaiGen's REST handling, result serialization, and media-library upload flow.
		 *
		 * @param null|object|WP_Error $result Initial null result, or a generated image result.
		 * @param string               $prompt The prompt text.
		 * @param string               $orientation The requested Core orientation.
		 * @param string               $provider The selected provider ID, or auto.
		 * @param mixed                $source_image_ids Reference attachment IDs.
		 */
		$pre_generated_result = apply_filters(
			'kaigen_pre_generate_image_result',
			null,
			$prompt,
			$orientation,
			$provider,
			$request->get_param( 'source_image_ids' )
		);

		if ( null === $pre_generated_result && ! function_exists( 'wp_ai_client_prompt' ) ) {
			return new WP_Error(
				'ai_client_unavailable',
				__( 'WordPress AI Client is not available.', 'kaigen' ),
				[ 'status' => 501 ]
			);
		}

		$timeout_filter = [ $this, 'filter_image_generation_timeout' ];

		try {
			add_filter( 'wp_ai_client_default_request_timeout', $timeout_filter );
			do_action( 'kaigen_before_image_generation_request' );

			$result = null !== $pre_generated_result
				? $pre_generated_result
				: $this->generate_image_result(
					$prompt,
					$orientation,
					$provider,
					$request->get_param( 'source_image_ids' )
				);
			if ( is_wp_error( $result ) ) {
				return $result;
			}

			$metadata   = $this->serialize_result_metadata( $result );
			$image_data = $this->extract_image_data( $result );
			if ( is_wp_error( $image_data ) ) {
				return $image_data;
			}

			$attachment = Image_Handler::upload_to_media_library( $image_data, $prompt, $metadata );
			if ( is_wp_error( $attachment ) ) {
				return $attachment;
			}

			$attachment['metadata'] = $metadata;

			return rest_ensure_response( $attachment );
		} catch ( \Throwable $e ) {
			return new WP_Error(
				'ai_generation_failed',
				$e->getMessage(),
				[ 'status' => 500 ]
			);
		} finally {
			do_action( 'kaigen_after_image_generation_request' );
			remove_filter( 'wp_ai_client_default_request_timeout', $timeout_filter );
		}
	}

	/**
	 * Raises the WP AI Client timeout for image generation requests.
	 *
	 * @return int Timeout in seconds.
	 */
	public function filter_image_generation_timeout() {
		return self::IMAGE_GENERATION_TIMEOUT;
	}

	/**
	 * Generates an image result and conditionally retries timeout-like failures with lower-level HTTP options.
	 *
	 * @param string $prompt The prompt text.
	 * @param string $orientation The requested Core orientation.
	 * @param string $provider The selected provider ID, or auto.
	 * @param mixed  $source_image_ids Reference attachment IDs.
	 * @return object|WP_Error AI image result, or error.
	 * @throws \Throwable When a non-timeout image generation exception occurs.
	 */
	private function generate_image_result( $prompt, $orientation, $provider, $source_image_ids ) {
		try {
			$result = $this->generate_image_result_once( $prompt, $orientation, $provider, $source_image_ids );
		} catch ( \Throwable $e ) {
			if ( ! $this->is_retryable_timeout_error( $e ) ) {
				throw $e;
			}

			$result = $e;
		}

		if ( ! $this->is_retryable_timeout_error( $result ) ) {
			return $result;
		}

		$http_options = new Image_Generation_HTTP_Options( self::IMAGE_GENERATION_TIMEOUT );

		try {
			$http_options->register();
			return $this->generate_image_result_once( $prompt, $orientation, $provider, $source_image_ids );
		} finally {
			$http_options->unregister();
		}
	}

	/**
	 * Generates an image result once.
	 *
	 * @param string $prompt The prompt text.
	 * @param string $orientation The requested Core orientation.
	 * @param string $provider The selected provider ID, or auto.
	 * @param mixed  $source_image_ids Reference attachment IDs.
	 * @return object|WP_Error AI image result, or error.
	 */
	private function generate_image_result_once( $prompt, $orientation, $provider, $source_image_ids ) {
		$builder = $this->build_prompt( $prompt, $orientation, $provider );

		$error = $this->attach_reference_images( $builder, $source_image_ids );
		if ( is_wp_error( $error ) ) {
			return $error;
		}

		if ( ! $builder->is_supported_for_image_generation() ) {
			return new WP_Error(
				'image_generation_not_supported',
				__( 'No configured WordPress AI provider supports this image generation request.', 'kaigen' ),
				[ 'status' => 400 ]
			);
		}

		return $builder->generate_image_result();
	}

	/**
	 * Checks whether an AI Client error is likely caused by a transport timeout.
	 *
	 * @param mixed $result AI Client result or error.
	 * @return bool True when the result should be retried with lower-level HTTP options.
	 */
	private function is_retryable_timeout_error( $result ) {
		if ( is_wp_error( $result ) ) {
			$message = $result->get_error_message();
			$code    = (string) $result->get_error_code();
		} elseif ( $result instanceof \Throwable ) {
			$message = $result->getMessage();
			$code    = (string) $result->getCode();
		} else {
			return false;
		}

		$message = strtolower( $message );
		$code    = strtolower( $code );

		foreach ( [ 'timeout', 'timed out', 'operation timed out', 'curl error 28', 'low speed' ] as $needle ) {
			if ( false !== strpos( $message, $needle ) || false !== strpos( $code, $needle ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Builds the WordPress AI Client prompt.
	 *
	 * @param string $prompt The prompt text.
	 * @param string $orientation The requested Core orientation.
	 * @param string $provider The selected provider ID, or auto.
	 * @return object Prompt builder.
	 */
	private function build_prompt( $prompt, $orientation, $provider ) {
		$builder = wp_ai_client_prompt()
			->with_text( $prompt );

		$file_type_class = 'WordPress\\AiClient\\Files\\Enums\\FileTypeEnum';
		if ( class_exists( $file_type_class ) ) {
			$builder->as_output_file_type( $file_type_class::inline() );
		}

		if ( '' !== $orientation ) {
			$orientation_class = 'WordPress\\AiClient\\Files\\Enums\\MediaOrientationEnum';
			if ( class_exists( $orientation_class ) ) {
				$builder->as_output_media_orientation( $orientation_class::from( $orientation ) );
			}
		}

		if ( '' !== $provider && 'auto' !== $provider ) {
			$builder->using_provider( $provider );
		}

		return $builder;
	}

	/**
	 * Attaches reference image files to the prompt builder.
	 *
	 * @param object $builder Prompt builder.
	 * @param mixed  $source_image_ids Reference attachment IDs.
	 * @return true|WP_Error True on success, or error.
	 */
	private function attach_reference_images( $builder, $source_image_ids ) {
		if ( ! is_array( $source_image_ids ) || empty( $source_image_ids ) ) {
			return true;
		}

		foreach ( $source_image_ids as $source_image_id ) {
			$attachment_id = absint( $source_image_id );
			if ( ! $attachment_id ) {
				continue;
			}

			if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
				return new WP_Error( 'forbidden_reference_file', __( 'You are not allowed to use that reference image.', 'kaigen' ), [ 'status' => 403 ] );
			}

			$file_path = get_attached_file( $attachment_id );
			if ( empty( $file_path ) || ! file_exists( $file_path ) ) {
				return new WP_Error( 'missing_reference_file', __( 'A reference image file could not be found.', 'kaigen' ), [ 'status' => 400 ] );
			}

			$filetype = wp_check_filetype( $file_path );
			$builder->with_file( $file_path, $filetype['type'] ?? null );
		}

		return true;
	}

	/**
	 * Extracts image data from a Core AI result.
	 *
	 * @param object $result The AI result object.
	 * @return string|WP_Error Binary image data, data URI, URL, or error.
	 */
	private function extract_image_data( $result ) {
		$file = null;
		if ( is_object( $result ) && method_exists( $result, 'to_file' ) ) {
			$file = $result->to_file();
		} elseif ( is_object( $result ) && method_exists( $result, 'toFile' ) ) {
			$file = $result->toFile();
		}

		if ( ! is_object( $file ) ) {
			return new WP_Error( 'missing_image_result', __( 'The AI Client did not return an image file.', 'kaigen' ), [ 'status' => 500 ] );
		}

		if ( method_exists( $file, 'get_data_uri' ) ) {
			return $file->get_data_uri();
		}

		if ( method_exists( $file, 'getDataUri' ) ) {
			return $file->getDataUri();
		}

		if ( method_exists( $file, 'get_data' ) ) {
			return $file->get_data();
		}

		if ( method_exists( $file, 'getData' ) ) {
			return $file->getData();
		}

		if ( method_exists( $file, 'get_url' ) ) {
			return $file->get_url();
		}

		if ( method_exists( $file, 'getUrl' ) ) {
			return $file->getUrl();
		}

		return new WP_Error( 'unsupported_image_result', __( 'The AI Client image result format is not supported.', 'kaigen' ), [ 'status' => 500 ] );
	}

	/**
	 * Serializes Core AI result metadata for the REST response.
	 *
	 * @param object $result The AI result.
	 * @return array Result metadata.
	 */
	private function serialize_result_metadata( $result ) {
		$metadata = [];

		if ( is_object( $result ) && method_exists( $result, 'getProviderMetadata' ) ) {
			$provider_metadata = $result->getProviderMetadata();
			if ( is_object( $provider_metadata ) && method_exists( $provider_metadata, 'toArray' ) ) {
				$metadata['provider_metadata'] = $provider_metadata->toArray();
			}
		}

		if ( is_object( $result ) && method_exists( $result, 'getModelMetadata' ) ) {
			$model_metadata = $result->getModelMetadata();
			if ( is_object( $model_metadata ) && method_exists( $model_metadata, 'toArray' ) ) {
				$metadata['model_metadata'] = $model_metadata->toArray();
			}
		}

		if ( $result instanceof \JsonSerializable ) {
			$serialized = $result->jsonSerialize();
			return is_array( $serialized ) ? array_merge( $serialized, $metadata ) : $metadata;
		}

		if ( is_object( $result ) && method_exists( $result, 'to_array' ) ) {
			$serialized = $result->to_array();
			return is_array( $serialized ) ? array_merge( $serialized, $metadata ) : $metadata;
		}

		if ( is_object( $result ) && method_exists( $result, 'toArray' ) ) {
			$serialized = $result->toArray();
			return is_array( $serialized ) ? array_merge( $serialized, $metadata ) : $metadata;
		}

		return $metadata;
	}

	/**
	 * Sanitizes the requested orientation.
	 *
	 * @param mixed $orientation Raw orientation.
	 * @return string Sanitized orientation.
	 */
	private function sanitize_orientation( $orientation ) {
		$orientation = sanitize_key( (string) $orientation );
		return in_array( $orientation, [ 'square', 'landscape', 'portrait' ], true ) ? $orientation : 'square';
	}
}
