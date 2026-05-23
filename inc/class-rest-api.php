<?php
/**
 * REST API functionality for the KaiGen plugin.
 *
 * @package KaiGen
 */

namespace KaiGen;

use WP_Error;
use WP_REST_Server;
use WordPress\AiClient\AiClient;
use WordPress\AiClient\Providers\Models\DTO\ModelRequirements;
use WordPress\AiClient\Providers\Models\Enums\CapabilityEnum;

/**
 * Handles REST API endpoints for the plugin.
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
	 * Default timeout for Core AI image generation requests, in seconds.
	 *
	 * @var int
	 */
	private const IMAGE_GENERATION_TIMEOUT = 180;

	/**
	 * Connection timeout for image generation requests, in seconds.
	 *
	 * @var int
	 */
	private const IMAGE_GENERATION_CONNECT_TIMEOUT = 30;

	/**
	 * Minimum transfer rate before cURL aborts image generation, in bytes per second.
	 *
	 * @var int
	 */
	private const IMAGE_GENERATION_LOW_SPEED_LIMIT = 1;

	/**
	 * Time below the low-speed limit before cURL aborts image generation, in seconds.
	 *
	 * @var int
	 */
	private const IMAGE_GENERATION_LOW_SPEED_TIME = 180;

	/**
	 * Initialize the REST API functionality.
	 */
	private function __construct() {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	/**
	 * Gets the singleton instance of this class.
	 *
	 * @return Rest_API The REST API instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Registers REST API routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			self::API_NAMESPACE,
			'/generate-image',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'handle_generate_request' ],
				'permission_callback' => [ $this, 'check_permission' ],
				'args'                => [
					'prompt'           => [
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_textarea_field',
					],
					'provider'         => [
						'type'              => 'string',
						'required'          => false,
						'sanitize_callback' => 'sanitize_key',
					],
					'orientation'      => [
						'type'              => 'string',
						'required'          => false,
						'enum'              => [ 'square', 'landscape', 'portrait' ],
						'sanitize_callback' => 'sanitize_key',
					],
					'source_image_ids' => [
						'type'     => 'array',
						'required' => false,
						'items'    => [
							'type' => 'integer',
						],
					],
				],
			]
		);

		register_rest_route(
			self::API_NAMESPACE,
			'/reference-images',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_reference_images' ],
				'permission_callback' => [ $this, 'check_permission' ],
			]
		);

		register_rest_route(
			self::API_NAMESPACE,
			'/providers',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_image_providers' ],
				'permission_callback' => [ $this, 'check_permission' ],
			]
		);
	}

	/**
	 * Checks whether the current user can use KaiGen.
	 *
	 * @return bool Whether the user has permission.
	 */
	public function check_permission() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Handles an image generation request through the WordPress AI Client.
	 *
	 * @param \WP_REST_Request $request The request object.
	 * @return \WP_REST_Response|WP_Error The response or error.
	 */
	public function handle_generate_request( $request ) {
		if ( ! function_exists( 'wp_ai_client_prompt' ) ) {
			return new WP_Error(
				'ai_client_unavailable',
				__( 'WordPress AI Client is not available.', 'kaigen' ),
				[ 'status' => 501 ]
			);
		}

		$prompt      = trim( (string) $request->get_param( 'prompt' ) );
		$provider    = sanitize_key( (string) $request->get_param( 'provider' ) );
		$orientation = $this->sanitize_orientation( $request->get_param( 'orientation' ) );

		if ( '' === $prompt ) {
			return new WP_Error( 'missing_prompt', __( 'Prompt is required.', 'kaigen' ), [ 'status' => 400 ] );
		}

		$timeout_filter      = [ $this, 'filter_image_generation_timeout' ];
		$request_args_filter = [ $this, 'filter_image_generation_request_args' ];
		$curl_options_filter = [ $this, 'apply_image_generation_curl_options' ];

		try {
			add_filter( 'wp_ai_client_default_request_timeout', $timeout_filter );
			add_filter( 'http_request_args', $request_args_filter, 10, 2 );
			add_action( 'http_api_curl', $curl_options_filter, 10, 3 );

			$builder = $this->build_prompt( $prompt, $orientation, $provider );

			$error = $this->attach_reference_images( $builder, $request->get_param( 'source_image_ids' ) );
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

			$result = $builder->generate_image_result();
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
			if ( isset( $timeout_filter ) ) {
				remove_filter( 'wp_ai_client_default_request_timeout', $timeout_filter );
			}

			return new WP_Error(
				'ai_generation_failed',
				$e->getMessage(),
				[ 'status' => 500 ]
			);
		} finally {
			remove_filter( 'wp_ai_client_default_request_timeout', $timeout_filter );
			remove_filter( 'http_request_args', $request_args_filter, 10 );
			remove_action( 'http_api_curl', $curl_options_filter, 10 );
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
	 * Raises WordPress HTTP API timeouts for OpenAI image generation requests.
	 *
	 * @param array  $args Request arguments.
	 * @param string $url Request URL.
	 * @return array Filtered request arguments.
	 */
	public function filter_image_generation_request_args( $args, $url ) {
		if ( ! $this->is_openai_image_generation_url( $url ) ) {
			return $args;
		}

		$args['timeout'] = max( (int) ( $args['timeout'] ?? 0 ), self::IMAGE_GENERATION_TIMEOUT );

		return $args;
	}

	/**
	 * Applies cURL options for slow OpenAI image generation responses.
	 *
	 * @param resource|\CurlHandle $handle cURL handle.
	 * @param array                $request_args Request arguments.
	 * @param string               $url Request URL.
	 * @return void
	 */
	public function apply_image_generation_curl_options( $handle, $request_args, $url ) {
		if ( ! $this->is_openai_image_generation_url( $url ) ) {
			return;
		}

		$timeout = max( (int) ( $request_args['timeout'] ?? 0 ), self::IMAGE_GENERATION_TIMEOUT );

		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_TIMEOUT, $timeout );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_CONNECTTIMEOUT, self::IMAGE_GENERATION_CONNECT_TIMEOUT );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_LOW_SPEED_LIMIT, self::IMAGE_GENERATION_LOW_SPEED_LIMIT );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_LOW_SPEED_TIME, self::IMAGE_GENERATION_LOW_SPEED_TIME );
	}

	/**
	 * Checks whether a URL is an OpenAI image generation endpoint.
	 *
	 * @param string $url Request URL.
	 * @return bool True when the URL is an OpenAI image generation endpoint.
	 */
	private function is_openai_image_generation_url( $url ) {
		$url = (string) $url;
		return 0 === strpos( $url, 'https://api.openai.com/v1/images/generations' ) ||
			0 === strpos( $url, 'https://api.openai.com/v1/images/edits' );
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
				return new WP_Error( 'forbidden_reference', __( 'You do not have permission to use one of the reference images.', 'kaigen' ), [ 'status' => 403 ] );
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
	 * Extracts binary image data from a Core AI result.
	 *
	 * @param object $result The AI result object.
	 * @return string|WP_Error Binary image data, URL, or error.
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
			return $this->decode_data_uri( $file->get_data_uri() );
		}

		if ( method_exists( $file, 'getDataUri' ) ) {
			return $this->decode_data_uri( $file->getDataUri() );
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
	 * Decodes a data URI to binary data.
	 *
	 * @param string $data_uri The data URI.
	 * @return string|WP_Error Binary data or error.
	 */
	private function decode_data_uri( $data_uri ) {
		if ( ! is_string( $data_uri ) || false === strpos( $data_uri, ',' ) ) {
			return new WP_Error( 'invalid_data_uri', __( 'The generated image data is invalid.', 'kaigen' ), [ 'status' => 500 ] );
		}

		$parts = explode( ',', $data_uri, 2 );
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- AI Client returns inline base64 image data.
		$decoded = base64_decode( $parts[1], true );
		if ( false === $decoded ) {
			return new WP_Error( 'invalid_image_data', __( 'The generated image data is not valid base64.', 'kaigen' ), [ 'status' => 500 ] );
		}

		return $decoded;
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

	/**
	 * Gets configured image-capable providers when Core exposes them cleanly.
	 *
	 * @return \WP_REST_Response Provider options.
	 */
	public function get_image_providers() {
		$providers = [
			[
				'id'   => 'auto',
				'name' => __( 'Auto', 'kaigen' ),
			],
		];

		if ( ! class_exists( AiClient::class ) || ! class_exists( ModelRequirements::class ) || ! class_exists( CapabilityEnum::class ) ) {
			return rest_ensure_response( $providers );
		}

		try {
			$registry     = AiClient::defaultRegistry();
			$requirements = new ModelRequirements(
				[ CapabilityEnum::imageGeneration() ],
				[]
			);

			foreach ( $registry->getRegisteredProviderIds() as $provider_id ) {
				$models = $registry->findProviderModelsMetadataForSupport( $provider_id, $requirements );
				if ( empty( $models ) ) {
					continue;
				}

				$provider_class = $registry->getProviderClassName( $provider_id );
				$providers[]    = [
					'id'   => $provider_id,
					'name' => $provider_class::metadata()->getName(),
				];
			}
		} catch ( \Throwable $e ) {
			return rest_ensure_response( $providers );
		}

		return rest_ensure_response(
			array_values(
				array_reduce(
					$providers,
					function ( $carry, $provider ) {
						$carry[ $provider['id'] ] = $provider;
						return $carry;
					},
					[]
				)
			)
		);
	}

	/**
	 * Retrieves all images marked as reference images.
	 *
	 * @return \WP_REST_Response The response containing reference images.
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
			$thumbnail     = wp_get_attachment_image_src( $post->ID, 'thumbnail' );
			$thumbnail_url = $thumbnail ? $thumbnail[0] : wp_get_attachment_url( $post->ID );

			$images[] = [
				'id'            => $post->ID,
				'url'           => wp_get_attachment_url( $post->ID ),
				'thumbnail_url' => $thumbnail_url,
				'alt'           => get_post_meta( $post->ID, '_wp_attachment_image_alt', true ),
			];
		}

		return rest_ensure_response( $images );
	}
}

Rest_API::get_instance();
