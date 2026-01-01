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
class Alt_Text_Generator_Replicate extends Alt_Text_Generator_Core {
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
	private const REPLICATE_MODEL = 'openai/gpt-5.2';

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

		$model = apply_filters( 'kaigen_alt_text_replicate_model', self::REPLICATE_MODEL );
		$input = [
			'prompt'                => $prompt,
			'system_prompt'         => $this->get_system_prompt(),
			'image_input'           => [ $image_data_url ],
			'verbosity'             => 'low',
			'reasoning_effort'      => 'low',
			'max_completion_tokens' => 120,
		];

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

		$response_body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $response_body ) ) {
			return new WP_Error( 'replicate_error', 'Unexpected response from Replicate.' );
		}

		$content = $this->extract_replicate_output( $response_body, $api_key );
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
	 * Extracts the output from a Replicate prediction (with short polling).
	 *
	 * @param array  $response_body Initial response body.
	 * @param string $api_key       Replicate API key.
	 * @return string|WP_Error Output string or error.
	 */
	private function extract_replicate_output( $response_body, $api_key ) {
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
