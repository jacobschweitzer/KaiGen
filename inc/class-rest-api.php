<?php
/**
 * REST API functionality for the KaiGen plugin.
 *
 * @package KaiGen
 */

namespace KaiGen;

use WP_Error;

/**
 * Handles all REST API endpoints and functionality for the plugin.
 */
final class Rest_API {
	/**
	 * Holds the singleton instance of this class.
	 *
	 * @var Rest_API
	 */
	private static $instance = null;

	/**
	 * The REST API namespace for this plugin.
	 *
	 * @var string
	 */
	private const API_NAMESPACE = 'kaigen/v1';

	/**
	 * Initialize the REST API functionality.
	 */
	private function __construct() {
		$this->init_hooks();
	}

	/**
	 * Gets the singleton instance of the REST controller.
	 *
	 * @return Rest_API The singleton instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Initialize WordPress hooks.
	 */
	private function init_hooks() {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	/**
	 * Registers all REST API routes for the plugin.
	 */
	public function register_routes() {
		// Register the image generation endpoint.
		register_rest_route(
			self::API_NAMESPACE,
			'/generate-image',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'handle_generate_request' ],
				'permission_callback' => [ $this, 'check_permission' ],
			]
		);

		// Register the providers endpoint.
		register_rest_route(
			self::API_NAMESPACE,
			'/providers',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_providers_with_keys' ],
				'permission_callback' => [ $this, 'check_permission' ],
			]
		);

		// Register the image-to-image providers endpoint.
		register_rest_route(
			self::API_NAMESPACE,
			'/image-to-image-providers',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_image_to_image_providers' ],
				'permission_callback' => [ $this, 'check_permission' ],
			]
		);

		// Register the reference images endpoint.
		register_rest_route(
			self::API_NAMESPACE,
			'/reference-images',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_reference_images' ],
				'permission_callback' => [ $this, 'check_permission' ],
			]
		);

		// Register the estimated generation time endpoint.
		register_rest_route(
			self::API_NAMESPACE,
			'/estimated-generation-time',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'get_estimated_generation_time' ],
				'permission_callback' => [ $this, 'check_permission' ],
			]
		);

		// Register the generation metadata endpoint.
		register_rest_route(
			self::API_NAMESPACE,
			'/generation-meta',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_generation_meta' ],
				'permission_callback' => [ $this, 'check_permission' ],
			]
		);
	}

	/**
	 * Checks if the current user has permission to access the endpoints.
	 *
	 * @return bool Whether the user has permission.
	 */
	public function check_permission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Handles the request to generate an image.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error The response or error.
	 */
	public function handle_generate_request( $request ) {
		// Get request parameters.
		$prompt      = $request->get_param( 'prompt' );
		$provider_id = $request->get_param( 'provider' );

		// Get provider model.
		$model = $this->get_provider_model( $provider_id );
		if ( is_wp_error( $model ) ) {
			return $model;
		}

		// Get additional parameters with defaults.
		$additional_params = $this->get_additional_params( $request );

		// Handle retries for image generation.
		$response = $this->handle_generation_with_retries( $provider_id, $prompt, $model, $additional_params );

		if ( $response instanceof \WP_REST_Response ) {
			$response_data = $response->get_data();
			if ( ! empty( $response_data['id'] ) ) {
				$this->maybe_save_generation_meta(
					absint( $response_data['id'] ),
					$request,
					$provider_id,
					$model,
					$additional_params
				);
			}
		}

		return $response;
	}

	/**
	 * Gets the estimated generation time for a request.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error The response or error.
	 */
	public function get_estimated_generation_time( $request ) {
		$provider_id = $request->get_param( 'provider' );
		if ( empty( $provider_id ) ) {
			return new WP_Error( 'invalid_provider', 'Provider is required.', [ 'status' => 400 ] );
		}

		$model = $this->get_provider_model( $provider_id );
		if ( is_wp_error( $model ) ) {
			return $model;
		}

		$additional_params = $this->get_additional_params( $request );
		$quality           = Image_Provider::get_quality_setting();
		$provider          = kaigen_provider_manager()->get_provider( $provider_id );

		if ( ! $provider ) {
			return new WP_Error( 'invalid_provider', "Invalid provider: {$provider_id}", [ 'status' => 400 ] );
		}

		$api_keys = get_option( 'kaigen_provider_api_keys', [] );
		$api_key  = isset( $api_keys[ $provider_id ] ) ? $api_keys[ $provider_id ] : '';

		$provider_class    = get_class( $provider );
		$provider_instance = new $provider_class( $api_key, $model );
		$estimated_time    = (int) $provider_instance->get_estimated_generation_time( $quality, $additional_params );

		return new \WP_REST_Response(
			[ 'estimated_time_seconds' => $estimated_time ],
			200
		);
	}

	/**
	 * Gets the stored generation metadata for a post.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error The response or error.
	 */
	public function get_generation_meta( $request ) {
		$attachment_id = absint( $request->get_param( 'attachment_id' ) );
		if ( ! $attachment_id ) {
			return new WP_Error( 'invalid_attachment_id', 'Attachment ID is required.', [ 'status' => 400 ] );
		}

		if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
			return new WP_Error( 'forbidden', 'You do not have permission to view this attachment.', [ 'status' => 403 ] );
		}

		$meta = get_post_meta( $attachment_id, 'kaigen_generation_meta', true );
		if ( ! is_array( $meta ) ) {
			$meta = [];
		}

		return new \WP_REST_Response( $meta, 200 );
	}

	/**
	 * Saves generation metadata on the post when available.
	 *
	 * @param int             $attachment_id The attachment ID.
	 * @param WP_REST_Request $request The request object.
	 * @param string          $provider_id The provider ID.
	 * @param string          $model The resolved model.
	 * @param array           $additional_params Additional parameters.
	 * @return void
	 */
	private function maybe_save_generation_meta( $attachment_id, $request, $provider_id, $model, $additional_params ) {
		if ( ! $attachment_id ) {
			return;
		}

		if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
			return;
		}

		$quality  = Image_Provider::get_quality_setting();
		$provider = kaigen_provider_manager()->get_provider( $provider_id );
		if ( ! $provider ) {
			return;
		}

		$api_keys = get_option( 'kaigen_provider_api_keys', [] );
		$api_key  = isset( $api_keys[ $provider_id ] ) ? $api_keys[ $provider_id ] : '';

		$provider_class    = get_class( $provider );
		$provider_instance = new $provider_class( $api_key, $model );
		$effective_model   = $provider_instance->get_effective_model( $quality, $additional_params );

		$meta             = [
			'prompt'   => sanitize_text_field( (string) $request->get_param( 'prompt' ) ),
			'provider' => sanitize_text_field( $provider_id ),
			'quality'  => sanitize_text_field( $quality ),
			'model'    => sanitize_text_field( $effective_model ),
		];
		$source_image_ids = $request->get_param( 'source_image_ids' );
		if ( is_array( $source_image_ids ) ) {
			$sanitized_ids = array_values(
				array_filter(
					array_map( 'absint', $source_image_ids )
				)
			);
			if ( ! empty( $sanitized_ids ) ) {
				$meta['reference_image_ids'] = $sanitized_ids;
			}
		}

		update_post_meta( $attachment_id, 'kaigen_generation_meta', $meta );
	}

	/**
	 * Gets the model for a specific provider.
	 *
	 * @param string $provider_id The provider ID.
	 * @return string|WP_Error The model or error.
	 */
	private function get_provider_model( $provider_id ) {
		// For Replicate, get the model based on quality setting.
		if ( 'replicate' === $provider_id ) {
			$quality = Image_Provider::get_quality_setting();

			$provider = kaigen_provider_manager()->get_provider( $provider_id );
			if ( $provider ) {
				$model = $provider->get_model_from_quality_setting( $quality );
				return $model;
			}
		}

		// For other providers, use the stored model or default.
		$provider_models = get_option( 'kaigen_provider_models', [] );
		$default_models  = [
			'openai' => 'dall-e-3',
		];

		if ( ! empty( $provider_models[ $provider_id ] ) ) {
			return $provider_models[ $provider_id ];
		}

		if ( ! empty( $default_models[ $provider_id ] ) ) {
			$model                           = $default_models[ $provider_id ];
			$provider_models[ $provider_id ] = $model;
			update_option( 'kaigen_provider_models', $provider_models );
			return $model;
		}

		return new WP_Error( 'model_not_set', "No model set for provider: {$provider_id}", [ 'status' => 400 ] );
	}

	/**
	 * Gets additional parameters with defaults from the request.
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return array The parameters.
	 */
	private function get_additional_params( $request ) {
		// Get saved quality settings.
		$quality          = Image_Provider::get_quality_setting();
		$quality_value    = 'hd' === $quality ? 100 : 80;
		$quality_settings = get_option( 'kaigen_quality_settings', [] );
		$style_value      = isset( $quality_settings['style'] ) ? $quality_settings['style'] : 'natural';

		$defaults = [
			'num_outputs'    => 1,
			'aspect_ratio'   => '1:1',
			'output_format'  => 'webp',
			'output_quality' => $quality_value,
		];

		// Get the provider and model.
		$provider_id     = $request->get_param( 'provider' );
		$provider_models = get_option( 'kaigen_provider_models', [] );
		$model           = $provider_models[ $provider_id ] ?? '';

		$params = [];
		foreach ( $defaults as $key => $default ) {
			$params[ $key ] = $request->get_param( $key ) ?? $default;
		}

		// Add source image URL if provided (single or array).
		$source_image_urls = $request->get_param( 'source_image_urls' );
		if ( ! empty( $source_image_urls ) ) {
			$params['source_image_urls'] = $source_image_urls;
		} else {
			$source_image_url = $request->get_param( 'source_image_url' );
			if ( ! empty( $source_image_url ) ) {
				$params['source_image_url'] = $source_image_url;
			}
		}

		// Add additional image URLs if provided (for multiple source images).
		$additional_image_urls = $request->get_param( 'additional_image_urls' );
		if ( ! empty( $additional_image_urls ) && is_array( $additional_image_urls ) ) {
			$params['additional_image_urls'] = $additional_image_urls;
		}

		// Add mask URL if provided (for inpainting).
		$mask_url = $request->get_param( 'mask_url' );
		if ( ! empty( $mask_url ) ) {
			$params['mask_url'] = $mask_url;
		}

		return $params;
	}

	/**
	 * Handles image generation with retries and longer timeouts for slow providers.
	 *
	 * @param string $provider_id The provider ID.
	 * @param string $prompt The generation prompt.
	 * @param string $model The model to use.
	 * @param array  $additional_params Additional parameters.
	 * @return WP_REST_Response|WP_Error The response or error.
	 * @throws \Exception When generation fails or times out.
	 */
	private function handle_generation_with_retries( $provider_id, $prompt, $model, $additional_params ) {
		$max_retries = 15;
		$retry_count = 0;
		$delay       = 3;
		$max_delay   = 20;

		while ( $retry_count < $max_retries ) {
			try {
				$result = $this->make_provider_request( $provider_id, $prompt, $model, $additional_params );

				if ( ! is_wp_error( $result ) ) {
					// Handle completed status - this means the image was successfully generated and uploaded.
					if ( isset( $result['status'] ) && 'completed' === $result['status'] ) {
						// Check if we have a WordPress attachment ID.
						if ( isset( $result['url'] ) && isset( $result['id'] ) && is_numeric( $result['id'] ) && $result['id'] > 0 ) {
							// Format response for WordPress media.
							$response_data = [
								'url'    => $result['url'],
								'id'     => intval( $result['id'] ),
								'status' => 'completed',
							];
							return new \WP_REST_Response( $response_data, 200 );
						}

						// Handle direct URL response without WordPress attachment.
						if ( isset( $result['url'] ) ) {
							// Return the result without an ID.
							$response_data = [
								'url'    => $result['url'],
								'status' => 'completed',
							];
							return new \WP_REST_Response( $response_data, 200 );
						}
					}

					// Handle failed status with content filtering error.
					if ( isset( $result['status'] ) && 'failed' === $result['status'] ) {
						if ( isset( $result['error'] ) && strpos( $result['error'], 'flagged by safety filters' ) !== false ) {
							return new WP_Error(
								'content_filtered',
								'The image was flagged by the provider\'s safety filters. Please modify your prompt and try again.',
								[ 'status' => 400 ]
							);
						}

						// Handle other failure cases.
						$error_message = isset( $result['error'] ) ? $result['error'] : 'Unknown error occurred';
						throw new \Exception( 'Generation failed: ' . $error_message );
					}

					// Check if we have a WordPress attachment ID.
					if ( isset( $result['url'] ) && isset( $result['id'] ) && is_numeric( $result['id'] ) && $result['id'] > 0 ) {
						// Format response for WordPress media.
						$response_data = [
							'url'    => $result['url'],
							'id'     => intval( $result['id'] ),
							'status' => 'completed',
						];
						return new \WP_REST_Response( $response_data, 200 );
					}

					// Handle direct URL response without WordPress attachment.
					if ( isset( $result['url'] ) ) {
						// Return the result without an ID.
						$response_data = [
							'url'    => $result['url'],
							'status' => 'completed',
						];
						return new \WP_REST_Response( $response_data, 200 );
					}

					// Handle processing status.
					if ( isset( $result['status'] ) && ( 'processing' === $result['status'] || 'starting' === $result['status'] ) ) {
						throw new \Exception( 'Image still processing' );
					}

					throw new \Exception( 'Invalid response format or incomplete generation' );
				}

				// Handle errors that should not be retried - return immediately.
				if ( in_array(
					$result->get_error_code(),
					[
						'image_to_image_error',
						'image_to_image_failed',
						'model_error',
						'image_download_failed',
						'empty_image_data',
						'replicate_validation_error',
						'replicate_api_error',
						'content_moderation',
						'api_error',
						'openai_error',
						'max_retries_exceeded',
						'invalid_api_key_format',
					],
					true
				) ) {
					return $result;
				}

				// Handle pending status.
				if ( 'replicate_pending' === $result->get_error_code() ||
					'processing' === $result->get_error_code() ) {
					$error_data = $result->get_error_data();
					if ( ! empty( $error_data['prediction_id'] ) ) {
						$additional_params['prediction_id'] = $error_data['prediction_id'];
					}
					sleep( (int) $delay );
					$delay = min( $delay * 1.5, $max_delay );
					continue;
				}

				throw new \Exception( $result->get_error_message() );

			} catch ( \Exception $e ) {
				++$retry_count;

				if ( $retry_count >= $max_retries ) {
					return new WP_Error(
						'api_error',
						'Failed after ' . $max_retries . ' attempts: ' . $e->getMessage(),
						[ 'status' => 500 ]
					);
				}

				$delay = min( $delay * 1.5, $max_delay );
				sleep( (int) $delay );
			}
		}
	}

	/**
	 * Makes the request to the provider.
	 *
	 * @param string $provider_id The provider ID.
	 * @param string $prompt The generation prompt.
	 * @param string $model The model to use.
	 * @param array  $additional_params Additional parameters.
	 * @return array|WP_Error The result or error.
	 */
	private function make_provider_request( $provider_id, $prompt, $model, $additional_params ) {
		$provider = kaigen_provider_manager()->get_provider( $provider_id );
		if ( ! $provider ) {
			return new WP_Error( 'invalid_provider', "Invalid provider: {$provider_id}" );
		}

		// Get API keys from options.
		$api_keys = get_option( 'kaigen_provider_api_keys', [] );
		$api_key  = isset( $api_keys[ $provider_id ] ) ? $api_keys[ $provider_id ] : '';

		$provider_class    = get_class( $provider );
		$provider_instance = new $provider_class( $api_key, $model );

		return $provider_instance->generate_image( $prompt, $additional_params );
	}

	/**
	 * Gets the list of providers with API keys.
	 *
	 * @return WP_REST_Response The response containing providers.
	 */
	public function get_providers_with_keys() {
		try {
			$providers = kaigen_admin()->get_active_providers();
			return new \WP_REST_Response( $providers, 200 );
		} catch ( \Exception $e ) {
			return new \WP_REST_Response(
				[ 'error' => 'Error fetching providers: ' . $e->getMessage() ],
				500
			);
		}
	}

	/**
	 * Gets the list of providers that support image-to-image generation.
	 *
	 * @return WP_REST_Response The response containing providers that support image-to-image.
	 */
	public function get_image_to_image_providers() {
		try {
			$image_to_image_providers = kaigen_provider_manager()->get_image_to_image_providers();
			return new \WP_REST_Response( $image_to_image_providers, 200 );
		} catch ( \Exception $e ) {
			return new \WP_REST_Response(
				[ 'error' => 'Error fetching image-to-image providers: ' . $e->getMessage() ],
				500
			);
		}
	}

	/**
	 * Retrieves all images marked as reference images.
	 *
	 * @return WP_REST_Response The response containing reference images.
	 */
	public function get_reference_images() {
		$query = new \WP_Query(
			[
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'posts_per_page' => 100,
				'meta_key'       => 'kaigen_reference_image', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'meta_value'     => 1, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			]
		);

		$images = [];
		foreach ( $query->posts as $post ) {
			// Get thumbnail URL (150x150) for display.
			$thumbnail     = wp_get_attachment_image_src( $post->ID, 'thumbnail' );
			$thumbnail_url = $thumbnail ? $thumbnail[0] : wp_get_attachment_url( $post->ID );

			$images[] = [
				'id'            => $post->ID,
				'url'           => wp_get_attachment_url( $post->ID ), // Full size for generation.
				'thumbnail_url' => $thumbnail_url, // Thumbnail for display.
				'alt'           => get_post_meta( $post->ID, '_wp_attachment_image_alt', true ),
			];
		}

		return new \WP_REST_Response( $images, 200 );
	}
}

// Initialize the REST API functionality.
\KaiGen\Rest_API::get_instance();
