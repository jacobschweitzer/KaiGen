<?php
/**
 * XAI API provider implementation for KaiGen.
 *
 * @package KaiGen
 */

namespace KaiGen\Providers;

use KaiGen\Image_Provider;
use WP_Error;

/**
 * XAI API provider implementation for KaiGen.
 *
 * Handles image generation and editing using xAI's image API.
 */
class Image_Provider_XAI extends Image_Provider {
	/**
	 * The base URL for the xAI image generation API.
	 */
	private const API_BASE_URL = 'https://api.x.ai/v1/images/generations';

	/**
	 * The base URL for the xAI image edit API.
	 */
	private const IMAGE_EDIT_API_BASE_URL = 'https://api.x.ai/v1/images/edits';

	/**
	 * Default xAI image model.
	 */
	private const DEFAULT_MODEL = 'grok-imagine-image';

	/**
	 * Gets the unique identifier for this provider.
	 *
	 * @return string The unique identifier for this provider.
	 */
	public function get_id() {
		return 'xai';
	}

	/**
	 * Gets the display name for this provider.
	 *
	 * @return string The display name for this provider.
	 */
	public function get_name() {
		return 'xAI';
	}

	/**
	 * Gets the current model being used by the provider.
	 *
	 * @return string The current model identifier.
	 */
	public function get_current_model() {
		return $this->model ? $this->model : self::DEFAULT_MODEL;
	}

	/**
	 * Makes the API request to generate an image.
	 *
	 * @param string $prompt The text prompt for image generation.
	 * @param array  $additional_params Additional parameters for image generation.
	 * @return array|WP_Error The API response or error.
	 */
	public function make_api_request( $prompt, $additional_params = [] ) {
		if ( ! $this->validate_api_key() ) {
			return new WP_Error( 'invalid_api_key_format', 'API key format is invalid.' );
		}

		$source_image_urls = $additional_params['source_image_urls'] ?? [];
		$source_image_url  = $additional_params['source_image_url'] ?? null;
		if ( $source_image_url ) {
			array_unshift( $source_image_urls, $source_image_url );
		}

		$source_image_urls = array_slice(
			array_values( array_unique( array_filter( $source_image_urls ) ) ),
			0,
			3
		);
		$has_source_image  = ! empty( $source_image_urls );

		$endpoint = $has_source_image ? self::IMAGE_EDIT_API_BASE_URL : self::API_BASE_URL;

		$body = [
			'model'  => $this->get_model_for_request( $additional_params['quality'] ?? '', $additional_params ),
			'prompt' => $prompt,
		];

		if ( $has_source_image ) {
			$images = [];

			foreach ( $source_image_urls as $image_url ) {
				$image_data = $this->get_image_data( $image_url );
				if ( is_wp_error( $image_data ) ) {
					return $image_data;
				}

				$images[] = [
					'url'  => $this->build_data_url( $image_url, $image_data ),
					'type' => 'image_url',
				];
			}

			if ( 1 === count( $images ) ) {
				$body['image'] = [
					'url' => $images[0]['url'],
				];
			} else {
				$body['images'] = $images;
			}
		}

		if ( ! empty( $additional_params['aspect_ratio'] ) ) {
			$body['aspect_ratio'] = $additional_params['aspect_ratio'];
		}

		if ( ! empty( $additional_params['num_outputs'] ) ) {
			$body['n'] = max( 1, min( 10, (int) $additional_params['num_outputs'] ) );
		}

		$headers = $this->get_request_headers();
		$body    = wp_json_encode( $body );

		$response = wp_remote_post(
			$endpoint,
			[
				'headers' => $headers,
				'body'    => $body,
				'timeout' => 180,
			]
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'xai_error', 'xAI API request failed: ' . $response->get_error_message() );
		}

		$response_body = wp_remote_retrieve_body( $response );
		$response_code = wp_remote_retrieve_response_code( $response );

		if ( 200 !== $response_code ) {
			$error_data = json_decode( $response_body, true );
			if ( isset( $error_data['error']['message'] ) ) {
				return new WP_Error( 'xai_error', $error_data['error']['message'] );
			}

			return new WP_Error( 'api_error', "API Error (HTTP $response_code): $response_body" );
		}

		return json_decode( $response_body, true );
	}

	/**
	 * Processes the API response to extract the image URL or data.
	 *
	 * @param mixed $response The API response to process.
	 * @return string|WP_Error The image URL/data or error.
	 */
	public function process_api_response( $response ) {
		if ( ! empty( $response['error'] ) ) {
			return new WP_Error( 'xai_error', $response['error']['message'] ?? 'Unknown error occurred' );
		}

		if ( empty( $response['data'] ) || ! is_array( $response['data'] ) ) {
			return new WP_Error( 'xai_error', 'Invalid response format from xAI' );
		}

		if ( empty( $response['data'][0]['url'] ) && empty( $response['data'][0]['b64_json'] ) ) {
			return new WP_Error( 'xai_error', 'Missing image data in xAI response' );
		}

		if ( ! empty( $response['data'][0]['url'] ) ) {
			$image_url = $response['data'][0]['url'];

			if ( ! filter_var( $image_url, FILTER_VALIDATE_URL ) ) {
				return new WP_Error( 'xai_error', 'Invalid image URL in response' );
			}

			return $image_url;
		}

		$b64_json = $response['data'][0]['b64_json'];
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Decoding API response, not obfuscation.
		$image_data = base64_decode( $b64_json );

		if ( ! $image_data ) {
			return new WP_Error( 'xai_error', 'Invalid base64 image data in response' );
		}

		return $image_data;
	}

	/**
	 * Validates the API key format according to xAI requirements.
	 *
	 * @return bool True if the API key is valid, false otherwise.
	 */
	public function validate_api_key() {
		return ! empty( $this->api_key );
	}

	/**
	 * Gets the available models for xAI.
	 *
	 * @return array List of available models.
	 */
	public function get_available_models() {
		return [
			self::DEFAULT_MODEL => 'Grok Imagine Image (xAI)',
		];
	}

	/**
	 * Resolves the model to use for a request.
	 *
	 * @param string $quality_setting Optional quality setting.
	 * @param array  $additional_params Optional additional parameters for the request.
	 * @return string The resolved model identifier.
	 */
	public function get_model_for_request( $quality_setting = '', $additional_params = [] ) {
		return $this->model ? $this->model : self::DEFAULT_MODEL;
	}

	/**
	 * Gets the estimated image generation time in seconds.
	 *
	 * @param string $quality_setting Optional quality setting.
	 * @param array  $additional_params Optional additional parameters for estimation.
	 * @return int Estimated time in seconds.
	 */
	public function get_estimated_generation_time( $quality_setting = '', $additional_params = [] ) {
		return 30;
	}

	/**
	 * Gets the maximum number of reference images supported for a request.
	 *
	 * @param string $quality_setting Optional quality setting.
	 * @param array  $additional_params Optional additional parameters for the request.
	 * @return int The maximum number of reference images.
	 */
	public function get_max_reference_images( $quality_setting = '', $additional_params = [] ) {
		return 3;
	}

	/**
	 * Gets the image data from a URL.
	 *
	 * @param string $image_url The URL of the image.
	 * @return string|WP_Error The image data or error.
	 */
	private function get_image_data( $image_url ) {
		$response = wp_remote_get( $image_url );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$image_data = wp_remote_retrieve_body( $response );
		if ( empty( $image_data ) ) {
			return new WP_Error( 'empty_image', 'Could not retrieve image data' );
		}

		return $image_data;
	}

	/**
	 * Builds a data URL for an image.
	 *
	 * @param string $image_url  The original image URL.
	 * @param string $image_data The raw image bytes.
	 * @return string The image data URL.
	 */
	private function build_data_url( $image_url, $image_data ) {
		$mime_type = $this->get_image_mime_type( $image_url );

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Encoding image bytes for API transport.
		return 'data:' . $mime_type . ';base64,' . base64_encode( $image_data );
	}

	/**
	 * Gets the MIME type of an image from its URL.
	 *
	 * @param string $image_url The URL of the image.
	 * @return string The MIME type.
	 */
	private function get_image_mime_type( $image_url ) {
		$extension = strtolower( pathinfo( $image_url, PATHINFO_EXTENSION ) );

		$mime_types = [
			'png'  => 'image/png',
			'jpg'  => 'image/jpeg',
			'jpeg' => 'image/jpeg',
			'webp' => 'image/webp',
		];

		return $mime_types[ $extension ] ?? 'application/octet-stream';
	}
}

/**
 * Registers the filter to format the xAI provider name.
 *
 * This filter is registered at module load time so it's available when
 * the provider manager formats provider names during class loading.
 */
add_filter(
	'kaigen_format_provider_name',
	function ( $formatted_name, $name, $name_lower ) {
		if ( 'xai' === $name_lower ) {
			return 'xAI';
		}
		return $formatted_name;
	},
	10,
	3
);
