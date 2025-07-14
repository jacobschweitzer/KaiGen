<?php
/**
 * fal.ai API provider implementation for KaiGen.
 *
 * @package KaiGen
 */

/**
 * This class handles image generation using the fal.ai API service.
 */
class KaiGen_Image_Provider_Fal extends KaiGen_Image_Provider {
	/**
	 * The base URL for the fal.ai API.
	 */
	private const API_BASE_URL = 'https://queue.fal.run/';

	/**
	 * Gets the unique identifier for this provider.
	 *
	 * @return string The unique identifier for this provider.
	 */
	public function get_id() {
		return 'fal';
	}

	/**
	 * Gets the display name for this provider.
	 *
	 * @return string The display name for this provider.
	 */
	public function get_name() {
		return 'fal.ai';
	}

	/**
	 * Gets the request headers for the API request.
	 *
	 * @return array The request headers.
	 */
	protected function get_request_headers() {
		return [
			'Authorization' => 'Key ' . $this->api_key,
			'Content-Type'  => 'application/json',
		];
	}

	/**
	 * Overrides the parent method to get the current model from the quality setting.
	 * 
	 * @return string The current model.
	 */
	public function get_current_model() {
		// Get quality settings
		$quality_settings = get_option('kaigen_quality_settings', []);
		$quality = isset($quality_settings['quality']) ? $quality_settings['quality'] : 'medium';
		
		$model = $this->get_model_from_quality_setting($quality);
		return $model;
	}

	/**
	 * Makes the API request to generate an image.
	 *
	 * @param string $prompt The text prompt for image generation.
	 * @param array $additional_params Additional parameters for image generation.
	 * @return array|WP_Error The API response or error.
	 */
	public function make_api_request($prompt, $additional_params = []) {
		// Handle polling mode if request_id exists
		if (!empty($additional_params['request_id'])) {
			return $this->check_request_status($additional_params['request_id']);
		}

		// Validate API key format immediately before any processing
		if (!$this->validate_api_key()) {
			return new WP_Error('invalid_api_key_format', 'API key format is invalid. fal.ai API keys should be in the correct format.');
		}

		$headers = $this->get_request_headers();

		$input_data = ['prompt' => $prompt];
		
		// Determine which model to use
		$model_to_use = $this->model;
		
		// Handle source_image_url parameter for image-to-image
		$source_image_url = $additional_params['source_image_url'] ?? $additional_params['image_url'] ?? null;
		
		// If source image is provided, use an image-to-image capable model
		if (!empty($source_image_url)) {
			$model_to_use = $this->get_image_to_image_model();

			// Process the image URL for fal.ai
			$processed_image = $this->process_image_url($source_image_url);
			if (is_wp_error($processed_image)) {
				return $processed_image;
			}
			
			$input_data['image_url'] = $processed_image;
		}
		
		// Remove processed parameters to prevent duplication
		unset($additional_params['source_image_url']);
		unset($additional_params['image_url']);

		// Add aspect ratio and other parameters
		if (isset($additional_params['aspect_ratio'])) {
			$input_data['aspect_ratio'] = $additional_params['aspect_ratio'];
		}

		// Set default values for common parameters
		if (!isset($input_data['num_inference_steps'])) {
			$input_data['num_inference_steps'] = 28; // Good balance of quality and speed
		}
		
		if (!isset($input_data['guidance_scale'])) {
			$input_data['guidance_scale'] = 3.5; // Good default for FLUX models
		}

		// Add remaining filtered parameters
		$valid_params = ['seed', 'num_inference_steps', 'guidance_scale', 'safety_tolerance', 'enable_safety_checker'];
		foreach ($valid_params as $param) {
			if (isset($additional_params[$param])) {
				$input_data[$param] = $additional_params[$param];
			}
		}

		$body = wp_json_encode($input_data);
		
		$api_url = self::API_BASE_URL . $model_to_use;

		// Make initial request
		$response = wp_remote_post(
			$api_url,
			[
				'headers' => $headers,
				'body'    => $body,
				'timeout' => 15,
			]
		);

		if (is_wp_error($response)) {
			return $response;
		}

		$response_code = wp_remote_retrieve_response_code($response);
		$response_body = wp_remote_retrieve_body($response);
		$body_data = json_decode($response_body, true);

		// Handle validation errors
		if ($response_code === 422 || $response_code === 400) {
			$error_message = 'Validation error from fal.ai API';
			if (isset($body_data['detail'])) {
				$error_message = 'Validation error: ' . (is_array($body_data['detail']) ? json_encode($body_data['detail']) : $body_data['detail']);
			}
			return new WP_Error('fal_validation_error', $error_message);
		}

		// Check for immediate errors in the response
		if (!empty($body_data['error'])) {
			return new WP_Error('fal_api_error', $body_data['error']);
		}

		// If we got a completed request with output, return it immediately
		if (isset($body_data['status']) && $body_data['status'] === 'COMPLETED' && 
			isset($body_data['data']) && !empty($body_data['data'])) {
			return [
				'status' => 'COMPLETED',
				'data' => $body_data['data'],
				'request_id' => $body_data['request_id'] ?? null
			];
		}

		// Return the response for polling (includes request_id)
		return $body_data;
	}

	/**
	 * Checks the status of a request.
	 *
	 * @param string $request_id The ID of the request to check.
	 * @return array|WP_Error The status response or error.
	 */
	private function check_request_status($request_id) {
		$headers = $this->get_request_headers();
		$api_url = "https://queue.fal.run/requests/{$request_id}/status";

		$response = wp_remote_get(
			$api_url,
			[
				'headers' => $headers,
				'timeout' => 8
			]
		);

		if (is_wp_error($response)) {
			return $response;
		}

		$body = json_decode(wp_remote_retrieve_body($response), true);

		// Return the full response to let process_api_response handle it
		return $body;
	}

	/**
	 * Processes the API response to extract the image URL or data.
	 *
	 * @param mixed $response The API response to process.
	 * @return string|WP_Error The image URL/data or error.
	 */
	public function process_api_response($response) {
		if (!is_array($response)) {
			return new WP_Error('fal_error', 'Invalid response format from fal.ai');
		}

		// Check for error in response
		if (!empty($response['error'])) {
			$error_message = $response['error'];
			
			// Check for content moderation failures
			if (strpos($error_message, 'safety') !== false || strpos($error_message, 'content') !== false) {
				return new WP_Error(
					'content_moderation',
					'Your prompt contains content that violates AI safety guidelines. Please try rephrasing it.'
				);
			}
			
			return new WP_Error('fal_error', $error_message);
		}

		// Check the request status
		$status = $response['status'] ?? 'unknown';

		// Handle failed status
		if ($status === 'FAILED') {
			$error_message = 'Image generation failed';
			
			// Check for detailed error message
			if (isset($response['error'])) {
				$error_message = $response['error'];
			}
			
			return new WP_Error('generation_failed', $error_message);
		}

		// Handle completed status with data
		if ($status === 'COMPLETED' && !empty($response['data'])) {
			// fal.ai typically returns data with images array
			if (isset($response['data']['images']) && !empty($response['data']['images'])) {
				$image_url = $response['data']['images'][0]['url'] ?? '';
				if (!empty($image_url)) {
					return $image_url;
				}
			}
			
			// Some models return image_url directly in data
			if (isset($response['data']['image_url'])) {
				return $response['data']['image_url'];
			}
			
			// Some models return url directly in data
			if (isset($response['data']['url'])) {
				return $response['data']['url'];
			}
		}

		// Return pending error with request ID for polling
		if (isset($response['request_id']) && ($status === 'IN_PROGRESS' || $status === 'IN_QUEUE')) {
			return new WP_Error(
				'fal_pending',
				'Image generation is still processing',
				['request_id' => $response['request_id']]
			);
		}

		return new WP_Error('fal_error', 'No image data in response');
	}

	/**
	 * Validates the API key format for fal.ai.
	 *
	 * @return bool True if the API key is valid, false otherwise.
	 */
	public function validate_api_key() {
		// fal.ai API keys are typically longer strings
		return !empty($this->api_key) && strlen($this->api_key) > 20;
	}

	/**
	 * Gets the available models for fal.ai.
	 *
	 * @return array List of available models with their display names.
	 */
	public function get_available_models() {
		return [
			'fal-ai/flux/schnell'         => 'FLUX Schnell (fast generation)',
			'fal-ai/flux/dev'             => 'FLUX Dev (high quality)',
			'fal-ai/fast-sdxl'            => 'Fast SDXL (fast generation)',
			'fal-ai/imagen4/preview'      => 'Imagen 4 Preview (highest quality)',
		];
	}

	/**
	 * Gets the image-to-image model for fal.ai.
	 *
	 * @return string The image-to-image model.
	 */
	private function get_image_to_image_model() {
		return 'fal-ai/flux/dev'; // FLUX Dev supports image-to-image
	}

	/**
	 * Checks if this provider supports image-to-image generation.
	 *
	 * @return bool True if image-to-image is supported, false otherwise.
	 */
	public function supports_image_to_image() {
		// fal.ai supports image-to-image via FLUX models
		return true;
	}

	/**
	 * Gets the model from the quality setting.
	 *
	 * @param string $quality_setting The quality setting.
	 * @return string The model.
	 */
	public function get_model_from_quality_setting($quality_setting) {
		switch ($quality_setting) {
			case 'low':
				$model = 'fal-ai/flux/schnell';
				break;
			case 'medium':
				$model = 'fal-ai/flux/dev';
				break;
			case 'high':
				$model = 'fal-ai/imagen4/preview';
				break;
			default:
				$model = 'fal-ai/flux/dev'; // Default to medium quality
		}
		return $model;
	}

	/**
	 * Processes image URL for fal.ai API.
	 * fal.ai can accept direct URLs, so we'll validate and return the URL.
	 * 
	 * @param string $image_url The image URL to process.
	 * @return string|WP_Error The processed URL or error.
	 */
	private function process_image_url($image_url) {
		// Validate URL format
		if (!filter_var($image_url, FILTER_VALIDATE_URL)) {
			return new WP_Error('invalid_url', 'Invalid image URL provided');
		}

		// Check if the URL is accessible with a HEAD request
		$head_response = wp_remote_head($image_url, ['timeout' => 10]);
		
		if (is_wp_error($head_response)) {
			$error_message = 'Image URL not accessible: ' . $head_response->get_error_message();
			return new WP_Error('image_not_accessible', $error_message);
		}
		
		$response_code = wp_remote_retrieve_response_code($head_response);
		if ($response_code !== 200) {
			return new WP_Error('image_not_accessible', "Image URL returned HTTP {$response_code}");
		}

		// fal.ai can handle direct URLs, so return as-is
		return $image_url;
	}
}