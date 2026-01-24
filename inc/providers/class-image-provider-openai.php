<?php
/**
 * OpenAI API provider implementation for KaiGen.
 *
 * @package KaiGen
 */

namespace KaiGen\Providers;

use KaiGen\Image_Provider;
use WP_Error;

/**
 * OpenAI API provider implementation for KaiGen.
 *
 * Handles image generation and editing using OpenAI's GPT Image API.
 */
class Image_Provider_OpenAI extends Image_Provider {
	/**
	 * The base URL for the OpenAI API.
	 */
	private const API_BASE_URL = 'https://api.openai.com/v1/images/generations';

	/**
	 * Image edit API endpoint.
	 */
	private const IMAGE_EDIT_API_BASE_URL = 'https://api.openai.com/v1/images/edits';

	/**
	 * Default OpenAI image model.
	 */
	private const DEFAULT_MODEL = 'gpt-image-1.5';

	/**
	 * Gets the unique identifier for this provider.
	 *
	 * @return string The unique identifier for this provider.
	 */
	public function get_id() {
		return 'openai';
	}

	/**
	 * Gets the display name for this provider.
	 *
	 * @return string The display name for this provider.
	 */
	public function get_name() {
		return 'OpenAI';
	}

	/**
	 * Makes the API request to generate an image.
	 *
	 * @param string $prompt The text prompt for image generation.
	 * @param array  $additional_params Additional parameters for image generation.
	 * @return array|WP_Error The API response or error.
	 */
	public function make_api_request( $prompt, $additional_params = [] ) {
		// Validate API key format immediately before any processing.
		if ( ! $this->validate_api_key() ) {
			return new WP_Error( 'invalid_api_key_format', 'API key format is invalid. OpenAI API keys should start with sk-proj-, sk-None-, sk-svcacct-, or sk-' );
		}

		// Handle source image URLs.
		$source_image_urls = $additional_params['source_image_urls'] ?? [];
		$source_image_url  = $additional_params['source_image_url'] ?? null;
		if ( $source_image_url ) {
			array_unshift( $source_image_urls, $source_image_url );
		}

		// Limit the number of source image URLs to 16.
		$source_image_urls = array_slice( array_unique( $source_image_urls ), 0, 16 );

		$max_retries = 3;
		$timeout     = 360; // Allow long-running high-quality generations.
		$retry_delay = 2; // Seconds to wait between retries.

		// Default to API_BASE_URL.
		$endpoint = self::API_BASE_URL;

		// Log if we're using image-to-image.
		if ( ! empty( $source_image_urls ) ) {
			$endpoint = self::IMAGE_EDIT_API_BASE_URL;
		}

		// Get quality setting from admin options or request override.
		$quality = $additional_params['quality'] ?? self::get_quality_setting();

		// Scale timeout based on quality to keep faster requests snappy.
		$timeout = 180;
		if ( 'low' === $quality ) {
			$timeout = 90;
		} elseif ( 'high' === $quality ) {
			$timeout = 360;
		}

		// Map quality settings to supported values.
		$quality_map = [
			'low'    => 'low',
			'medium' => 'medium',
			'high'   => 'high',
		];

		// Ensure we're using a supported quality value.
		$quality = isset( $quality_map[ $quality ] ) ? $quality_map[ $quality ] : 'medium';

		// Prepare the request based on the type of request.
		if ( ! empty( $source_image_urls ) ) {
			// For image edit requests, we need to use multipart/form-data.
			$boundary = wp_generate_password( 24, false );
			$headers  = array_merge(
				$this->get_request_headers(),
				[ 'Content-Type' => 'multipart/form-data; boundary=' . $boundary ]
			);

			// Start building the multipart body.
			$body = '';

			// Add model parameter.
			$body .= "--{$boundary}\r\n";
			$body .= 'Content-Disposition: form-data; name="model"' . "\r\n\r\n";
			$body .= self::DEFAULT_MODEL . "\r\n";

			// Add prompt parameter.
			$body .= "--{$boundary}\r\n";
			$body .= 'Content-Disposition: form-data; name="prompt"' . "\r\n\r\n";
			$body .= $prompt . "\r\n";

			// Add quality parameter.
			$body .= "--{$boundary}\r\n";
			$body .= 'Content-Disposition: form-data; name="quality"' . "\r\n\r\n";
			$body .= $quality . "\r\n";

			// Add moderation parameter.
			$body .= "--{$boundary}\r\n";
			$body .= 'Content-Disposition: form-data; name="moderation"' . "\r\n\r\n";
			$body .= "low\r\n";

			// Add format parameter (jpeg is faster than png).
			$body .= "--{$boundary}\r\n";
			$body .= 'Content-Disposition: form-data; name="output_format"' . "\r\n\r\n";
			$body .= "jpeg\r\n";

			// Add image files.
			foreach ( $source_image_urls as $index => $image_url ) {
				$image_data = $this->get_image_data( $image_url );
				if ( is_wp_error( $image_data ) ) {
					return $image_data;
				}

				$body .= "--{$boundary}\r\n";
				$body .= 'Content-Disposition: form-data; name="image[]"; filename="' . basename( $image_url ) . '"' . "\r\n";
				$body .= 'Content-Type: ' . $this->get_image_mime_type( $image_url ) . "\r\n\r\n";
				$body .= $image_data . "\r\n";
			}

			// Close the multipart body.
			$body .= "--{$boundary}--\r\n";

		} else {
			// For regular image generation requests, use JSON.
			$headers = $this->get_request_headers();
			$body    = [
				'model'         => self::DEFAULT_MODEL,
				'prompt'        => $prompt,
				'quality'       => $quality,
				'moderation'    => 'low',
				'output_format' => 'jpeg',
			];

			// Add size parameter if aspect ratio is specified.
			if ( isset( $additional_params['aspect_ratio'] ) ) {
				list($width, $height) = $this->map_aspect_ratio_to_dimensions( $additional_params['aspect_ratio'] ?? '1:1' );
				$body['size']         = "{$width}x{$height}";
			}

			$body = wp_json_encode( $body );
		}

		// Make the API request with retries.
		$attempt        = 0;
		$last_error     = null;
		$final_response = null;
		$final_error    = null;

		$curl_override = function ( $handle, $request_args, $url ) use ( $timeout ) {
			if ( false === strpos( $url, 'api.openai.com' ) ) {
				return;
			}

			// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Needed to prevent low-speed aborts for long-running requests.
			curl_setopt( $handle, CURLOPT_TIMEOUT, $timeout );
			// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Needed to prevent low-speed aborts for long-running requests.
			curl_setopt( $handle, CURLOPT_CONNECTTIMEOUT, 30 );
			// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Needed to prevent low-speed aborts for long-running requests.
			curl_setopt( $handle, CURLOPT_LOW_SPEED_TIME, 180 );
			// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Needed to prevent low-speed aborts for long-running requests.
			curl_setopt( $handle, CURLOPT_LOW_SPEED_LIMIT, 1 );
		};

		add_action( 'http_api_curl', $curl_override, 10, 3 );

		while ( $attempt < $max_retries ) {
			++$attempt;

			$response = wp_remote_post(
				$endpoint,
				[
					'headers' => $headers,
					'body'    => $body,
					'timeout' => $timeout,
				]
			);

			if ( is_wp_error( $response ) ) {
				$last_error    = $response;
				$error_message = $response->get_error_message();

				// Check if it's a timeout error.
				if ( strpos( $error_message, 'timeout' ) !== false ) {
					if ( $attempt < $max_retries ) {
						sleep( $retry_delay );
						continue;
					}
				}

				$final_error = new WP_Error( 'openai_error', 'OpenAI API request failed: ' . $error_message );
				break;
			}

			$response_body = wp_remote_retrieve_body( $response );
			$response_code = wp_remote_retrieve_response_code( $response );

			if ( 200 !== $response_code ) {
				// Parse error response.
				$error_data = json_decode( $response_body, true );
				if ( isset( $error_data['error']['message'] ) ) {
					$error_message = $error_data['error']['message'];

					// Check for specific error about image URL in prompt.
					if ( strpos( $error_message, 'image URL' ) !== false ) {
						// Remove the image URL from the body and retry.
						$body['prompt'] = $prompt;
						$retry_response = wp_remote_post(
							$endpoint,
							[
								'headers' => $this->get_request_headers(),
								'body'    => wp_json_encode( $body ),
								'timeout' => $timeout,
							]
						);

						if ( ! is_wp_error( $retry_response ) ) {
							$retry_body = wp_remote_retrieve_body( $retry_response );
							$retry_code = wp_remote_retrieve_response_code( $retry_response );

							if ( $retry_code < 400 ) {
								$final_response = json_decode( $retry_body, true );
								break;
							}
						}
					}

					$final_error = new WP_Error( 'openai_error', $error_message );
					break;
				}

				$final_error = new WP_Error( 'api_error', "API Error (HTTP $response_code): $response_body" );
				break;
			}

			// Success! Return the response.
			$final_response = json_decode( $response_body, true );
			break;
		}

		remove_action( 'http_api_curl', $curl_override, 10 );

		if ( null !== $final_response ) {
			return $final_response;
		}

		if ( $final_error ) {
			return $final_error;
		}

		if ( $last_error ) {
			return new WP_Error( 'openai_error', 'OpenAI API request failed: ' . $last_error->get_error_message() );
		}

		return new WP_Error( 'max_retries_exceeded', 'Maximum retry attempts exceeded' );
	}

	/**
	 * Processes the API response to extract the image URL.
	 *
	 * @param mixed $response The API response to process.
	 * @return string|WP_Error The image URL or error.
	 */
	public function process_api_response( $response ) {
		// Log the raw response for debugging.

		// Check for error in response.
		if ( ! empty( $response['error'] ) ) {
			return new WP_Error( 'openai_error', $response['error']['message'] ?? 'Unknown error occurred' );
		}

		// Check for valid response format.
		if ( empty( $response['data'] ) || ! is_array( $response['data'] ) ) {
			return new WP_Error( 'openai_error', 'Invalid response format from OpenAI' );
		}

		// Check for either URL or b64_json in the first data item.
		if ( empty( $response['data'][0]['url'] ) && empty( $response['data'][0]['b64_json'] ) ) {
			return new WP_Error( 'openai_error', 'Missing image data in OpenAI response' );
		}

		// Get the image URL (prefer URL over b64_json).
		$image_url = '';
		if ( ! empty( $response['data'][0]['url'] ) ) {
			$image_url = $response['data'][0]['url'];

			// Validate URL format.
			if ( ! filter_var( $image_url, FILTER_VALIDATE_URL ) ) {
				return new WP_Error( 'openai_error', 'Invalid image URL in response' );
			}
		} elseif ( ! empty( $response['data'][0]['b64_json'] ) ) {
			// Handle base64 encoded images.
			$b64_json = $response['data'][0]['b64_json'];
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Decoding API response, not obfuscation.
			$image_data = base64_decode( $b64_json );

			if ( ! $image_data ) {
				return new WP_Error( 'openai_error', 'Invalid base64 image data in response' );
			}

			// Return the raw image data - the parent class will handle uploading to media library.
			return $image_data;
		}

		// Just return the URL - the parent class will handle uploading to media library.
		return $image_url;
	}

	/**
	 * Validates the API key format according to OpenAI's current standards.
	 *
	 * @return bool True if the API key matches any of the valid formats, false otherwise.
	 */
	public function validate_api_key() {
		// Check if API key exists.
		if ( empty( $this->api_key ) ) {
			return false;
		}

		// Check if the key starts with any of the valid prefixes.
		$valid_prefixes = [ 'sk-proj-', 'sk-None-', 'sk-svcacct-', 'sk-' ];

		foreach ( $valid_prefixes as $prefix ) {
			if ( strpos( $this->api_key, $prefix ) === 0 ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Gets the available models for OpenAI.
	 *
	 * @return array List of available models.
	 */
	public function get_available_models() {
		return [
			self::DEFAULT_MODEL => 'GPT Image 1.5 (latest model)',
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
		$has_source_images = ! empty( $additional_params['source_image_urls'] ) ||
			! empty( $additional_params['source_image_url'] ) ||
			! empty( $additional_params['additional_image_urls'] );

		switch ( $quality ) {
			case 'low':
				$base_time = 20;
				break;
			case 'high':
				$base_time = 60;
				break;
			case 'medium':
			default:
				$base_time = 25;
				break;
		}

		if ( $has_source_images ) {
			return (int) ceil( $base_time * 1.25 );
		}

		return $base_time;
	}

	/**
	 * Resolves the model to use for a request.
	 *
	 * @param string $quality_setting Optional quality setting.
	 * @param array  $additional_params Optional additional parameters for the request.
	 * @return string The resolved model identifier.
	 */
	public function get_model_for_request( $quality_setting = '', $additional_params = [] ) {
		return self::DEFAULT_MODEL;
	}

	/**
	 * Maps aspect ratio to OpenAI's supported size formats.
	 *
	 * @param string $aspect_ratio The desired aspect ratio.
	 * @return string The corresponding OpenAI size parameter.
	 */
	private function map_aspect_ratio_to_size( $aspect_ratio ) {
		$sizes = [
			'1:1'  => '1024x1024',
			'16:9' => '1792x1024',
			'9:16' => '1024x1792',
			'4:3'  => '1344x1024',
			'3:4'  => '1024x1344',
		];

		return $sizes[ $aspect_ratio ] ?? '1024x1024';
	}

	/**
	 * Maps aspect ratio to width and height dimensions for GPT Image-1.
	 *
	 * @param string $aspect_ratio The desired aspect ratio.
	 * @return array Array containing width and height as integers.
	 */
	private function map_aspect_ratio_to_dimensions( $aspect_ratio ) {
		$dimensions = [
			'1:1'  => [ 1024, 1024 ],
			'16:9' => [ 1792, 1024 ],
			'9:16' => [ 1024, 1792 ],
			'4:3'  => [ 1344, 1024 ],
			'3:4'  => [ 1024, 1344 ],
		];

		return $dimensions[ $aspect_ratio ] ?? [ 1024, 1024 ];
	}

	/**
	 * Validates an image for editing.
	 *
	 * @param string $image_url The URL of the image to validate.
	 * @return bool|WP_Error True if valid, WP_Error if invalid.
	 */
	public function validate_image_for_edit( $image_url ) {
		// Check if the image URL is valid.
		if ( ! filter_var( $image_url, FILTER_VALIDATE_URL ) ) {
			return new WP_Error( 'invalid_url', 'Invalid image URL provided' );
		}

		// Get the image file extension.
		$extension = strtolower( pathinfo( $image_url, PATHINFO_EXTENSION ) );

		// Check if the file type is supported.
		$supported_types = [ 'png', 'webp', 'jpg', 'jpeg' ];
		if ( ! in_array( $extension, $supported_types, true ) ) {
			return new WP_Error( 'unsupported_type', 'Image must be PNG, WebP, or JPG format' );
		}

		// Check file size (25MB limit for GPT Image-1).
		$response = wp_remote_head( $image_url );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$content_length = wp_remote_retrieve_header( $response, 'content-length' );
		if ( $content_length && $content_length > 25 * 1024 * 1024 ) {
			return new WP_Error( 'file_too_large', 'Image must be less than 25MB' );
		}

		return true;
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
 * Registers the filter to format the OpenAI provider name.
 *
 * This filter is registered at module load time so it's available when
 * the provider manager formats provider names during class loading.
 */
add_filter(
	'kaigen_format_provider_name',
	function ( $formatted_name, $name, $name_lower ) {
		if ( 'openai' === $name_lower ) {
			return 'OpenAI';
		}
		return $formatted_name;
	},
	10,
	3
);
