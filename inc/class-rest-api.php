<?php
/**
 * REST API functionality for the KaiGen plugin.
 *
 * @package KaiGen
 */

namespace KaiGen;

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
	 * Fallback reference image limit when provider metadata does not expose one.
	 *
	 * @var int
	 */
	private const DEFAULT_REFERENCE_IMAGE_LIMIT = 5;

	/**
	 * Image generation service.
	 *
	 * @var Image_Generation_Service
	 */
	private $image_generation_service;

	/**
	 * Initialize the REST API functionality.
	 */
	private function __construct() {
		$this->image_generation_service = new Image_Generation_Service();
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
		return $this->image_generation_service->generate_from_request( $request );
	}

	/**
	 * Gets configured image-capable providers when Core exposes them cleanly.
	 *
	 * @return \WP_REST_Response Provider options.
	 */
	public function get_image_providers() {
		return rest_ensure_response( $this->get_image_provider_options() );
	}

	/**
	 * Gets configured image-capable provider options.
	 *
	 * @return array Provider options.
	 */
	public function get_image_provider_options() {
		$providers = [
			[
				'id'                  => 'auto',
				'name'                => __( 'Auto', 'kaigen' ),
				'referenceImageLimit' => self::DEFAULT_REFERENCE_IMAGE_LIMIT,
			],
		];

		if ( ! class_exists( AiClient::class ) || ! class_exists( ModelRequirements::class ) || ! class_exists( CapabilityEnum::class ) ) {
			return $providers;
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
					'id'                  => $provider_id,
					'name'                => $provider_class::metadata()->getName(),
					'referenceImageLimit' => $this->get_provider_reference_image_limit( $provider_id, $models ),
				];
			}
		} catch ( \Throwable $e ) {
			return $providers;
		}

		$provider_limits = array_filter(
			array_map(
				function ( $provider ) {
					return 'auto' !== $provider['id'] ? absint( $provider['referenceImageLimit'] ?? 0 ) : 0;
				},
				$providers
			)
		);

		if ( ! empty( $provider_limits ) ) {
			$providers[0]['referenceImageLimit'] = min( $provider_limits );
		}

		return array_values(
			array_reduce(
				$providers,
				function ( $carry, $provider ) {
					$carry[ $provider['id'] ] = $provider;
					return $carry;
				},
				[]
			)
		);
	}

	/**
	 * Gets the maximum reference image count for a provider.
	 *
	 * @param string $provider_id Provider ID.
	 * @param array  $models Provider model metadata.
	 * @return int Reference image limit.
	 */
	private function get_provider_reference_image_limit( $provider_id, $models ) {
		$limit = null;
		foreach ( $models as $model ) {
			$model_limit = $this->extract_reference_image_limit( $model );
			if ( null === $model_limit ) {
				continue;
			}

			$limit = null === $limit ? $model_limit : min( $limit, $model_limit );
		}

		/**
		 * Filters a provider's maximum selectable reference image count.
		 *
		 * @param int    $limit Provider reference image limit.
		 * @param string $provider_id Provider ID.
		 * @param array  $models Provider model metadata.
		 */
		$limit = apply_filters(
			'kaigen_provider_reference_image_limit',
			null === $limit ? self::DEFAULT_REFERENCE_IMAGE_LIMIT : $limit,
			$provider_id,
			$models
		);

		$limit = absint( $limit );
		return $limit > 0 ? $limit : self::DEFAULT_REFERENCE_IMAGE_LIMIT;
	}

	/**
	 * Extracts a reference image limit from model metadata when exposed.
	 *
	 * @param mixed $metadata Model metadata.
	 * @return int|null Reference image limit, or null when unavailable.
	 */
	private function extract_reference_image_limit( $metadata ) {
		$data = $this->metadata_to_array( $metadata );
		if ( empty( $data ) ) {
			return null;
		}

		$limit_keys = [
			'maxReferenceImages',
			'max_reference_images',
			'referenceImageLimit',
			'reference_image_limit',
			'maxSourceImages',
			'max_source_images',
			'sourceImageLimit',
			'source_image_limit',
			'maxInputImages',
			'max_input_images',
			'maxInputFiles',
			'max_input_files',
		];

		foreach ( $limit_keys as $key ) {
			if ( isset( $data[ $key ] ) && is_numeric( $data[ $key ] ) ) {
				return absint( $data[ $key ] );
			}
		}

		foreach ( $data as $value ) {
			if ( is_array( $value ) || is_object( $value ) ) {
				$limit = $this->extract_reference_image_limit( $value );
				if ( null !== $limit ) {
					return $limit;
				}
			}
		}

		return null;
	}

	/**
	 * Converts metadata objects to arrays for capability inspection.
	 *
	 * @param mixed $metadata Metadata value.
	 * @return array Metadata array.
	 */
	private function metadata_to_array( $metadata ) {
		if ( is_array( $metadata ) ) {
			return $metadata;
		}

		if ( $metadata instanceof \JsonSerializable ) {
			$serialized = $metadata->jsonSerialize();
			return is_array( $serialized ) ? $serialized : [];
		}

		if ( is_object( $metadata ) && method_exists( $metadata, 'to_array' ) ) {
			$serialized = $metadata->to_array();
			return is_array( $serialized ) ? $serialized : [];
		}

		if ( is_object( $metadata ) && method_exists( $metadata, 'toArray' ) ) {
			$serialized = $metadata->toArray();
			return is_array( $serialized ) ? $serialized : [];
		}

		return [];
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
