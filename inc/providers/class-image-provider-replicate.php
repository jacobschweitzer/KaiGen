<?php
/**
 * Replicate API provider implementation for KaiGen.
 *
 * @package KaiGen
 */

namespace KaiGen\Providers;

use KaiGen\Image_Provider;
use WP_Error;

/**
 * This class handles image generation using the Replicate API service.
 */
class Image_Provider_Replicate extends Image_Provider {
	/**
	 * The base URL for the Replicate API.
	 */
	private const API_BASE_URL = 'https://api.replicate.com/v1/models/';

	/**
	 * Gets the unique identifier for this provider.
	 *
	 * @return string The unique identifier for this provider.
	 */
	public function get_id() {
		return 'replicate';
	}

	/**
	 * Gets the display name for this provider.
	 *
	 * @return string The display name for this provider.
	 */
	public function get_name() {
		return 'Replicate';
	}

	/**
	 * Gets the request headers for the API request.
	 * Uses sync mode with shorter timeout since data URLs are no longer supported.
	 *
	 * @return array The request headers.
	 */
	protected function get_request_headers() {
		return [
			'Authorization' => 'Token ' . $this->api_key,
			'Content-Type'  => 'application/json',
			'Prefer'        => 'wait=10', // Shorter sync timeout since we only wait for URL.
		];
	}

	/**
	 * Overrides the parent method to get the current model from the quality setting.
	 *
	 * @return string The current model.
	 */
	public function get_current_model() {
		$quality = self::get_quality_setting();
		$model   = $this->get_model_from_quality_setting( $quality );
		return $model;
	}

	/**
	 * Makes the API request to generate an image.
	 *
	 * @param string $prompt The text prompt for image generation.
	 * @param array  $additional_params Additional parameters for image generation.
	 * @return array|WP_Error The API response or error.
	 */
	public function make_api_request( $prompt, $additional_params = [] ) {
		// Handle polling mode if prediction_id exists.
		if ( ! empty( $additional_params['prediction_id'] ) ) {
			return $this->check_prediction_status( $additional_params['prediction_id'] );
		}

		$headers = $this->get_request_headers();

		$input_data = [ 'prompt' => $prompt ];

		// Determine which model to use.
		$model_to_use = $this->model;

		// Handle source image URLs (can be single string or array).
		$source_image_urls = $additional_params['source_image_urls'] ?? $additional_params['source_image_url'] ?? null;
		if ( ! empty( $source_image_urls ) ) {
			if ( ! is_array( $source_image_urls ) ) {
				$source_image_urls = [ $source_image_urls ];
			}

			$image_inputs = [];
			foreach ( $source_image_urls as $url ) {
				if ( count( $image_inputs ) >= 10 ) {
					break;
				}
				$processed = $this->process_image_url( $url );
				if ( ! is_wp_error( $processed ) ) {
					$image_inputs[] = $processed;
				}
			}

			if ( ! empty( $image_inputs ) ) {
				$model_to_use              = $this->get_image_to_image_model();
				$input_data['image_input'] = $image_inputs;

				// Set size to 2K for low quality image edits (seedream-4.5 only supports "2K", "4K", or "custom").
				$quality = self::get_quality_setting();

				if ( 'low' === $quality ) {
					$additional_params['size'] = '2K';
				}
			}
		}

		// Remove source image parameters to prevent duplication.
		unset( $additional_params['source_image_urls'] );
		unset( $additional_params['source_image_url'] );
		unset( $additional_params['input_image'] );

		// Filter parameters based on the model being used.
		if ( ! empty( $source_image_urls ) ) {
			// For seedream-4.5, only keep valid parameters according to schema.
			$valid_params    = [ 'size', 'width', 'height', 'max_images', 'aspect_ratio', 'sequential_image_generation' ];
			$filtered_params = [];

			foreach ( $valid_params as $param ) {
				if ( isset( $additional_params[ $param ] ) ) {
					$value                     = $additional_params[ $param ];
					$filtered_params[ $param ] = $value;
				}
			}

			$additional_params = $filtered_params;
		} else {
			/**
			 * Remove unsupported generic params to avoid 422 validation errors.
			 */
			$valid_general_params = [ 'seed', 'aspect_ratio', 'size', 'width', 'height', 'guidance_scale' ];
			$filtered_params      = [];
			foreach ( $valid_general_params as $param ) {
				if ( isset( $additional_params[ $param ] ) ) {
					$filtered_params[ $param ] = $additional_params[ $param ];
				}
			}
			$additional_params = $filtered_params;
		}

		$body = [
			'input' => array_merge(
				$input_data,
				$additional_params // Add other params like aspect_ratio etc.
			),
		];

		$api_url = self::API_BASE_URL . "{$model_to_use}/predictions";

		// Make initial request with shorter timeout since we're just waiting for the URL.
		$response = wp_remote_post(
			$api_url,
			[
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
				'timeout' => 15,
			]
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$response_code = wp_remote_retrieve_response_code( $response );

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		// Validate JSON response - if json_decode failed, body will be null.
		if ( null === $body && json_last_error() !== JSON_ERROR_NONE ) {
			$raw_body = wp_remote_retrieve_body( $response );
			return new WP_Error(
				'replicate_api_error',
				'Invalid JSON response from Replicate API. Response code: ' . $response_code . '. Body: ' . substr( $raw_body, 0, 200 )
			);
		}

		// Ensure body is an array for safe access.
		if ( ! is_array( $body ) ) {
			$raw_body = wp_remote_retrieve_body( $response );
			return new WP_Error(
				'replicate_api_error',
				'Unexpected response format from Replicate API. Response code: ' . $response_code . '. Body: ' . substr( $raw_body, 0, 200 )
			);
		}

		// Handle 422 validation errors specifically - RETURN IMMEDIATELY.
		if ( 422 === $response_code ) {
			$error_message = 'Validation error from Replicate API';
			if ( isset( $body['detail'] ) ) {
				$error_message = 'Validation error: ' . ( is_array( $body['detail'] ) ? wp_json_encode( $body['detail'] ) : $body['detail'] );
			}
			return new WP_Error( 'replicate_validation_error', $error_message );
		}

		// Check for immediate errors in the response.
		if ( ! empty( $body['error'] ) ) {
			$error_message = $body['error'];

			// Check for content moderation errors and return them immediately.
			if (
				strpos( $error_message, "violate Google's Responsible AI practices" ) !== false ||
				strpos( $error_message, 'sensitive words' ) !== false ||
				strpos( $error_message, 'content moderation' ) !== false ||
				strpos( $error_message, 'flagged as sensitive' ) !== false ||
				strpos( $error_message, 'E005' ) !== false
			) {
				return new WP_Error( 'content_moderation', 'Your prompt contains content that violates AI safety guidelines. Please try rephrasing it.' );
			}

			// Return API errors immediately without retry.
			return new WP_Error( 'replicate_api_error', $error_message );
		}

		// If we got a completed prediction with output, return it immediately.
		if ( isset( $body['status'] ) && 'succeeded' === $body['status'] &&
			isset( $body['output'] ) && ! empty( $body['output'] ) ) {
			return [
				'status' => 'succeeded',
				'output' => $body['output'],
				'id'     => $body['id'],
			];
		}

		// Return the response for polling.
		return $body;
	}

	/**
	 * Checks the status of a prediction.
	 *
	 * @param string $prediction_id The ID of the prediction to check.
	 * @return array|WP_Error The status response or error.
	 */
	private function check_prediction_status( $prediction_id ) {
		$headers = $this->get_request_headers();
		$api_url = "https://api.replicate.com/v1/predictions/{$prediction_id}";

		$response = wp_remote_get(
			$api_url,
			[
				'headers' => $headers,
				'timeout' => 8,
			]
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		// Validate JSON response - if json_decode failed, body will be null.
		if ( null === $body && json_last_error() !== JSON_ERROR_NONE ) {
			$raw_body      = wp_remote_retrieve_body( $response );
			$response_code = wp_remote_retrieve_response_code( $response );
			return new WP_Error(
				'replicate_api_error',
				'Invalid JSON response from Replicate API when checking prediction status. Response code: ' . $response_code . '. Body: ' . substr( $raw_body, 0, 200 )
			);
		}

		// Ensure body is an array for safe access.
		if ( ! is_array( $body ) ) {
			$raw_body      = wp_remote_retrieve_body( $response );
			$response_code = wp_remote_retrieve_response_code( $response );
			return new WP_Error(
				'replicate_api_error',
				'Unexpected response format from Replicate API when checking prediction status. Response code: ' . $response_code . '. Body: ' . substr( $raw_body, 0, 200 )
			);
		}

		// Return the full response to let the process_api_response handle it.
		return $body;
	}

	/**
	 * Processes the API response to extract the image URL or data.
	 *
	 * @param mixed $response The API response to process.
	 * @return string|WP_Error The image URL/data or error.
	 */
	public function process_api_response( $response ) {

		if ( ! is_array( $response ) ) {
			return new WP_Error( 'replicate_error', 'Invalid response format from Replicate' );
		}

		// Check for error in response.
		if ( ! empty( $response['error'] ) ) {
			$error_message = $response['error'];

			// Check for content moderation failures first (highest priority).
			if (
				strpos( $error_message, '400 Image generation failed' ) !== false ||
				strpos( $error_message, 'flagged as sensitive' ) !== false ||
				strpos( $error_message, 'E005' ) !== false ||
				strpos( $error_message, "violate Google's Responsible AI practices" ) !== false ||
				strpos( $error_message, 'sensitive words' ) !== false ||
				strpos( $error_message, 'content moderation' ) !== false
			) {
				return new WP_Error(
					'content_moderation',
					'Your prompt contains content that violates AI safety guidelines. Please try rephrasing it.'
				);
			}

			// Check for image-to-image specific errors.
			if ( strpos( $error_message, 'image' ) !== false && strpos( $error_message, 'parameter' ) !== false ) {
				return new WP_Error(
					'image_to_image_error',
					'Image-to-image generation failed: ' . $error_message . '. Please check that your source image is valid and accessible.'
				);
			}

			// Check for model-specific errors.
			if ( strpos( $error_message, 'flux-kontext-pro' ) !== false || strpos( $error_message, 'model' ) !== false ) {
				return new WP_Error(
					'model_error',
					'Model error: ' . $error_message . '. The image-to-image model may be temporarily unavailable.'
				);
			}

			// Return the raw error for other cases.
			return new WP_Error( 'replicate_error', $error_message );
		}

		// Check the prediction status.
		$status = $response['status'] ?? 'unknown';

		// Handle failed status specifically.
		if ( 'failed' === $status ) {
			$error_message = 'Image generation failed';

			// Check both error field and logs for detailed error messages.
			$error_details = $response['error'] ?? '';
			$logs          = $response['logs'] ?? '';

			// Look for image-to-image specific failures.
			if (
				strpos( $error_details . $logs, 'image' ) !== false &&
				strpos( $error_details . $logs, 'parameter' ) !== false
			) {
				$error_message = 'Image-to-image generation failed. Please check that your source image is valid and accessible.';
				return new WP_Error( 'image_to_image_failed', $error_message );
			}

			// Look for content moderation failures in both error and logs.
			if (
				strpos( $error_details . $logs, "violate Google's Responsible AI practices" ) !== false ||
				strpos( $error_details . $logs, 'sensitive words' ) !== false ||
				strpos( $error_details . $logs, 'content moderation' ) !== false ||
				strpos( $error_details . $logs, 'flagged as sensitive' ) !== false ||
				strpos( $error_details . $logs, 'E005' ) !== false
			) {
				$error_message = 'Your prompt contains content that violates AI safety guidelines. Please try rephrasing it.';
				return new WP_Error( 'content_moderation', $error_message );
			}

			// Use the specific error message if available.
			if ( ! empty( $error_details ) ) {
				$error_message = $error_details;
			}

			return new WP_Error( 'generation_failed', $error_message );
		}

		// Handle succeeded status with direct output URL.
		if ( 'succeeded' === $status && ! empty( $response['output'] ) ) {
			$image_url = is_array( $response['output'] ) ? $response['output'][0] : $response['output'];
			return $image_url;
		}

		// Return pending error with prediction ID for polling.
		if ( isset( $response['id'] ) ) {
			return new WP_Error(
				'replicate_pending',
				'Image generation is still processing',
				[ 'prediction_id' => $response['id'] ]
			);
		}

		return new WP_Error( 'replicate_error', 'No image data in response' );
	}

	/**
	 * Validates the API key format for Replicate.
	 *
	 * @return bool True if the API key is valid, false otherwise.
	 */
	public function validate_api_key() {
		// Replicate API keys are typically 40 characters long.
		return ! empty( $this->api_key ) && strlen( $this->api_key ) === 40;
	}

	/**
	 * Gets the available models for Replicate.
	 *
	 * @return array List of available models with their display names.
	 */
	public function get_available_models() {
		return [
			'prunaai/hidream-l1-fast' => 'HiDream-I1 Fast by PrunaAI (low quality)',
			'bytedance/seedream-4.5'  => 'Seedream 4.5 by Bytedance (high quality)',
			'google/nano-banana-pro'  => 'Nano Banana Pro by Google (highest quality)',
		];
	}

	/**
	 * Gets the estimated image generation time in seconds.
	 *
	 * @param string $quality_setting Optional quality setting.
	 * @param array  $additional_params Optional additional parameters for estimation.
	 * @return int Estimated time in seconds.
	 */
	public function get_estimated_generation_time( $quality_setting = '', $additional_params = [] ) {
		$quality           = $quality_setting ? $quality_setting : self::get_quality_setting();
		$model             = $this->get_effective_model( $quality, $additional_params );
		$has_source_images = ! empty( $additional_params['source_image_urls'] ) ||
			! empty( $additional_params['source_image_url'] );

		switch ( $model ) {
			case 'prunaai/hidream-l1-fast':
				$base_time = 3;
				break;
			case 'bytedance/seedream-4.5':
				$base_time = 20;
				break;
			case 'google/nano-banana-pro':
				$base_time = 40;
				break;
			default:
				$base_time = 30;
				break;
		}

		if ( $has_source_images ) {
			return (int) ceil( $base_time * 1.25 );
		}

		return $base_time;
	}

	/**
	 * Gets the effective model used for a generation request.
	 *
	 * @param string $quality_setting Optional quality setting.
	 * @param array  $additional_params Optional additional parameters for the request.
	 * @return string The effective model identifier.
	 */
	public function get_effective_model( $quality_setting = '', $additional_params = [] ) {
		$quality = $quality_setting ? $quality_setting : self::get_quality_setting();
		$model   = $this->model ? $this->model : $this->get_model_from_quality_setting( $quality );

		$has_source_images = ! empty( $additional_params['source_image_urls'] ) ||
			! empty( $additional_params['source_image_url'] );

		if ( $has_source_images ) {
			$model = $this->get_image_to_image_model();
		}

		return $model;
	}

	/**
	 * Gets the image-to-image model for Replicate based on quality setting.
	 *
	 * @return string The image-to-image model.
	 */
	private function get_image_to_image_model() {
		$model   = 'bytedance/seedream-4.5';
		$quality = self::get_quality_setting();

		if ( 'high' === $quality ) {
			$model = 'google/nano-banana-pro';
		}

		return $model;
	}

	/**
	 * Gets the model from the quality setting.
	 *
	 * @param string $quality_setting The quality setting.
	 * @return string The model.
	 */
	public function get_model_from_quality_setting( $quality_setting ) {
		switch ( $quality_setting ) {
			case 'low':
				$model = 'prunaai/hidream-l1-fast';
				break;
			case 'medium':
				$model = 'bytedance/seedream-4.5';
				break;
			case 'high':
				$model = 'google/nano-banana-pro';
				break;
			default:
				$model = 'bytedance/seedream-4.5'; // Default to medium quality.
		}
		return $model;
	}

	/**
	 * Processes image URL for Replicate API.
	 * Always converts images to base64 data URLs for reliability.
	 *
	 * @param string $image_url The image URL to process.
	 * @return string|WP_Error The base64 data URL, or error.
	 */
	private function process_image_url( $image_url ) {
		// Check if the URL is accessible first with a HEAD request.
		$head_response = wp_remote_head( $image_url, [ 'timeout' => 10 ] );

		if ( is_wp_error( $head_response ) ) {
			$error_message = 'Image URL not accessible: ' . $head_response->get_error_message();
			return new WP_Error( 'image_not_accessible', $error_message );
		}

		// Check if the URL is local.
		$parsed_url = wp_parse_url( $image_url );
		$host       = strtolower( $parsed_url['host'] ?? '' );
		$is_local   = false;
		if ( 'localhost' === $host || '127.0.0.1' === $host || '::1' === $host ) {
			$is_local = true;
		} elseif ( preg_match( '/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/', $host ) ) {
			$is_local = true;
		}

		if ( ! $is_local ) {
			// Public URL - return directly since it's accessible.
			return $image_url;
		}

		// Local URL - download and convert to base64 with increased timeout.
		$response = wp_remote_get(
			$image_url,
			[
				'timeout' => 30, // Increased from default 5 seconds to 30 seconds.
			]
		);

		if ( is_wp_error( $response ) ) {
			$error_message = 'Failed to download image: ' . $response->get_error_message();
			return new WP_Error( 'image_download_failed', $error_message );
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $response_code ) {
			$error_message = "Failed to download image: HTTP {$response_code}";
			return new WP_Error( 'image_download_failed', $error_message );
		}

		$image_data = wp_remote_retrieve_body( $response );
		if ( empty( $image_data ) ) {
			return new WP_Error( 'empty_image_data', 'Downloaded image data is empty' );
		}

		// Get the content type.
		$content_type = wp_remote_retrieve_header( $response, 'content-type' );
		if ( empty( $content_type ) ) {
			// Try to determine from file extension.
			$extension    = strtolower( pathinfo( $image_url, PATHINFO_EXTENSION ) );
			$mime_types   = [
				'jpg'  => 'image/jpeg',
				'jpeg' => 'image/jpeg',
				'png'  => 'image/png',
				'webp' => 'image/webp',
				'gif'  => 'image/gif',
			];
			$content_type = $mime_types[ $extension ] ?? 'image/jpeg';
		}

		// Convert to base64 data URL.
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Used for legitimate data URL encoding.
		$base64_data = base64_encode( $image_data );
		$data_url    = "data:{$content_type};base64,{$base64_data}";

		return $data_url;
	}
}
