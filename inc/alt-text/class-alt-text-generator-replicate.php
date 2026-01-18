<?php
/**
 * Replicate alt text generator.
 *
 * @package KaiGen
 */

namespace KaiGen;

use WP_Error;

/**
 * Generates alt text using Replicate.
 */
class Alt_Text_Generator_Replicate implements Alt_Text_Generator_Core {
	use Alt_Text_Generator_Helpers;

	/**
	 * Replicate API URL for model predictions.
	 *
	 * @var string
	 */
	private const REPLICATE_API_URL = 'https://api.replicate.com/v1/models/';

	/**
	 * Replicate model used for alt text generation.
	 *
	 * @var string
	 */
	private const REPLICATE_MODEL = 'google/gemini-3-pro';

	/**
	 * Replicate fallback model used for alt text generation.
	 *
	 * @var string
	 */
	private const REPLICATE_FALLBACK_MODEL = 'openai/gpt-5-mini';

	/**
	 * Generates alt text using Replicate.
	 *
	 * @param string $prompt The prompt describing the image.
	 * @param string $image_data_url Base64 data URL of the image.
	 * @return string|WP_Error Alt text or error on failure.
	 */
	public function generate( $prompt, $image_data_url = '' ) {
		if ( '' === $image_data_url ) {
			return new WP_Error(
				'missing_image',
				'Image data is required for alt text generation.',
				[ 'status' => 400 ]
			);
		}

		$api_key = $this->get_api_key();
		if ( '' === $api_key ) {
			return new WP_Error(
				'missing_replicate_key',
				'Replicate API key is required for alt text generation.',
				[ 'status' => 400 ]
			);
		}

		$model          = apply_filters( 'kaigen_alt_text_replicate_model', self::REPLICATE_MODEL );
		$fallback_model = apply_filters( 'kaigen_alt_text_replicate_fallback_model', self::REPLICATE_FALLBACK_MODEL );
		$image_key      = apply_filters( 'kaigen_alt_text_replicate_image_key', 'images' );
		$input          = $this->build_gemini_input( $prompt, $image_data_url, $image_key );
		$input          = apply_filters( 'kaigen_alt_text_replicate_input', $input, $prompt, $image_data_url );

		$response = $this->make_replicate_request( $model, $input, $api_key );
		if ( is_wp_error( $response ) && $this->should_retry_with_fallback( $response ) ) {
			$fallback_input = $this->build_openai_input( $prompt, $image_data_url );
			$fallback_input = apply_filters( 'kaigen_alt_text_replicate_fallback_input', $fallback_input, $prompt, $image_data_url );
			$response       = $this->make_replicate_request( $fallback_model, $fallback_input, $api_key );
		}
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$response_body = $response;

		$content = $this->extract_replicate_output( $response_body, $api_key );
		if ( is_wp_error( $content ) && $this->should_retry_with_fallback( $content ) ) {
			$fallback_input = $this->build_openai_input( $prompt, $image_data_url );
			$fallback_input = apply_filters( 'kaigen_alt_text_replicate_fallback_input', $fallback_input, $prompt, $image_data_url );
			$response_body  = $this->make_replicate_request( $fallback_model, $fallback_input, $api_key );
			if ( is_wp_error( $response_body ) ) {
				return $response_body;
			}
			$content = $this->extract_replicate_output( $response_body, $api_key );
		}
		if ( is_wp_error( $content ) ) {
			return $content;
		}

		$content = $this->sanitize_alt_text( $content );
		if ( '' === $content ) {
			return new WP_Error( 'invalid_replicate_response', 'Replicate response did not include alt text.' );
		}

		return $content;
	}

	/**
	 * Builds the input payload for Gemini Replicate models.
	 *
	 * @param string $prompt         The prompt text.
	 * @param string $image_data_url Base64 data URL of the image.
	 * @param string $image_key      Image input key for the model.
	 * @return array Input payload.
	 */
	private function build_gemini_input( $prompt, $image_data_url, $image_key ) {
		return [
			'prompt'             => $prompt,
			'system_instruction' => $this->get_system_prompt(),
			$image_key           => [ $image_data_url ],
		];
	}

	/**
	 * Builds the input payload for OpenAI Replicate models.
	 *
	 * @param string $prompt         The prompt text.
	 * @param string $image_data_url Base64 data URL of the image.
	 * @return array Input payload.
	 */
	private function build_openai_input( $prompt, $image_data_url ) {
		return [
			'prompt'           => $prompt,
			'system_prompt'    => $this->get_system_prompt(),
			'image_input'      => [ $image_data_url ],
			'verbosity'        => 'low',
			'reasoning_effort' => 'minimal',
		];
	}

	/**
	 * Makes a Replicate prediction request for alt text generation.
	 *
	 * @param string $model   Replicate model identifier.
	 * @param array  $input   Input payload.
	 * @param string $api_key Replicate API key.
	 * @return array|WP_Error Decoded response body or error.
	 */
	private function make_replicate_request( $model, $input, $api_key ) {
		$response = wp_remote_post(
			self::REPLICATE_API_URL . $model . '/predictions',
			[
				'headers' => [
					'Authorization' => 'Token ' . $api_key,
					'Content-Type'  => 'application/json',
					'Prefer'        => 'wait=10',
				],
				'timeout' => 20,
				'body'    => wp_json_encode( [ 'input' => $input ] ),
			]
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'replicate_error', 'Alt text generation failed: ' . $response->get_error_message() );
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		$response_body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $response_body ) ) {
			return new WP_Error( 'replicate_error', 'Unexpected response from Replicate.' );
		}
		if ( $response_code >= 400 ) {
			$error_message = $response_body['detail'] ?? $response_body['error'] ?? 'Alt text generation failed.';
			if ( is_array( $error_message ) ) {
				$error_message = wp_json_encode( $error_message );
			}
			return new WP_Error( 'replicate_error', $error_message );
		}

		return $response_body;
	}

	/**
	 * Extracts the output from a Replicate prediction (with short polling).
	 *
	 * @param array  $response_body Initial response body.
	 * @param string $api_key       Replicate API key.
	 * @return string|WP_Error Output string or error.
	 */
	private function extract_replicate_output( $response_body, $api_key ) {
		if ( ! empty( $response_body['error'] ) ) {
			$error_message = $response_body['error'];
			if ( is_array( $error_message ) ) {
				$error_message = wp_json_encode( $error_message );
			}
			return new WP_Error( 'replicate_error', $error_message );
		}

		if ( isset( $response_body['output'] ) && ! empty( $response_body['output'] ) ) {
			return $this->coerce_replicate_output( $response_body['output'] );
		}

		if ( empty( $response_body['id'] ) ) {
			return new WP_Error( 'replicate_error', 'Replicate response did not include prediction output.' );
		}

		$prediction_id = $response_body['id'];
		$attempts      = 0;

		while ( $attempts < 5 ) {
			++$attempts;
			sleep( 1 );

			$status_response = wp_remote_get(
				"https://api.replicate.com/v1/predictions/{$prediction_id}",
				[
					'headers' => [
						'Authorization' => 'Token ' . $api_key,
					],
					'timeout' => 10,
				]
			);

			if ( is_wp_error( $status_response ) ) {
				return new WP_Error( 'replicate_error', 'Alt text generation failed: ' . $status_response->get_error_message() );
			}

			$status_body = json_decode( wp_remote_retrieve_body( $status_response ), true );
			if ( ! is_array( $status_body ) ) {
				return new WP_Error( 'replicate_error', 'Unexpected Replicate status response.' );
			}
			if ( ! empty( $status_body['error'] ) ) {
				$error_message = $status_body['error'];
				if ( is_array( $error_message ) ) {
					$error_message = wp_json_encode( $error_message );
				}
				return new WP_Error( 'replicate_error', $error_message );
			}

			if ( isset( $status_body['status'] ) && 'succeeded' === $status_body['status'] ) {
				return $this->coerce_replicate_output( $status_body['output'] ?? '' );
			}

			if ( isset( $status_body['status'] ) && 'failed' === $status_body['status'] ) {
				return new WP_Error( 'replicate_error', 'Replicate alt text generation failed.' );
			}
		}

		return new WP_Error( 'replicate_error', 'Replicate alt text generation is still running.' );
	}

	/**
	 * Coerces Replicate output to a string with filter fallback.
	 *
	 * @param mixed $output The output field.
	 * @return string The output as text.
	 */
	private function coerce_replicate_output( $output ) {
		if ( is_array( $output ) ) {
			return trim( implode( '', $output ) );
		}

		if ( is_string( $output ) ) {
			return trim( $output );
		}

		$filtered = apply_filters( 'kaigen_alt_text_replicate_output', '', $output );
		if ( is_string( $filtered ) ) {
			return trim( $filtered );
		}

		return '';
	}

	/**
	 * Determines whether to retry with the fallback model.
	 *
	 * @param WP_Error $error Replicate error response.
	 * @return bool True if fallback should be attempted.
	 */
	private function should_retry_with_fallback( $error ) {
		$message = $error->get_error_message();
		$signals = [
			'exceeded your current quota',
			'check your plan and billing details',
			'request limit',
			'quota',
			'e001',
		];

		foreach ( $signals as $signal ) {
			if ( false !== stripos( $message, $signal ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Retrieves the Replicate API key from saved provider settings.
	 *
	 * @return string The API key or empty string if not found.
	 */
	private function get_api_key() {
		$api_keys = get_option( 'kaigen_provider_api_keys', [] );
		$api_key  = isset( $api_keys['replicate'] ) ? $api_keys['replicate'] : '';
		return is_string( $api_key ) ? trim( $api_key ) : '';
	}
}
