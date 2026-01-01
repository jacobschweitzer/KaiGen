<?php
/**
 * OpenAI alt text generator.
 *
 * @package KaiGen
 */

namespace KaiGen;

use WP_Error;

/**
 * Generates alt text using OpenAI.
 */
class Alt_Text_Generator_OpenAI extends Alt_Text_Generator_Core {
	/**
	 * OpenAI API URL for responses.
	 *
	 * @var string
	 */
	private const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

	/**
	 * OpenAI model used for alt text generation.
	 *
	 * @var string
	 */
	private const OPENAI_MODEL = 'gpt-5.2';

	/**
	 * Generates alt text using OpenAI.
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
				'missing_openai_key',
				'OpenAI API key is required for alt text generation.',
				[ 'status' => 400 ]
			);
		}

		$request_body = [
			'model'             => self::OPENAI_MODEL,
			'temperature'       => 0.2,
			'max_output_tokens' => 120,
			'input'             => [
				[
					'role'    => 'system',
					'content' => [
						[
							'type' => 'input_text',
							'text' => $this->get_system_prompt(),
						],
					],
				],
				[
					'role'    => 'user',
					'content' => [
						[
							'type' => 'input_text',
							'text' => $prompt,
						],
						[
							'type'      => 'input_image',
							'image_url' => $image_data_url,
						],
					],
				],
			],
		];

		$response = wp_remote_post(
			self::OPENAI_API_URL,
			[
				'headers' => [
					'Authorization' => 'Bearer ' . $api_key,
					'Content-Type'  => 'application/json',
				],
				'timeout' => 30,
				'body'    => wp_json_encode( $request_body ),
			]
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'openai_error', 'Alt text generation failed: ' . $response->get_error_message() );
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		$response_body = wp_remote_retrieve_body( $response );

		if ( 200 !== $response_code ) {
			$error_message = 'OpenAI API request failed.';
			$decoded_body  = json_decode( $response_body, true );
			if ( isset( $decoded_body['error']['message'] ) ) {
				$error_message = $decoded_body['error']['message'];
			}
			return new WP_Error( 'openai_error', $error_message );
		}

		$decoded_response = json_decode( $response_body, true );
		$content          = $this->extract_response_text( $decoded_response );
		$content          = $this->sanitize_alt_text( $content );

		if ( '' === $content ) {
			return new WP_Error( 'invalid_openai_response', 'OpenAI response did not include alt text.' );
		}

		return $content;
	}

	/**
	 * Extracts text content from a Responses API payload.
	 *
	 * @param array $response Parsed response payload.
	 * @return string Extracted text.
	 */
	private function extract_response_text( $response ) {
		if ( ! is_array( $response ) || empty( $response['output'] ) ) {
			return '';
		}

		foreach ( $response['output'] as $output ) {
			if ( empty( $output['content'] ) || ! is_array( $output['content'] ) ) {
				continue;
			}
			foreach ( $output['content'] as $content ) {
				if ( isset( $content['type'], $content['text'] ) && 'output_text' === $content['type'] ) {
					return $content['text'];
				}
			}
		}

		return '';
	}

	/**
	 * Retrieves the OpenAI API key from saved provider settings.
	 *
	 * @return string The API key or empty string if not found.
	 */
	private function get_api_key() {
		$api_keys = get_option( 'kaigen_provider_api_keys', [] );
		$api_key  = isset( $api_keys['openai'] ) ? $api_keys['openai'] : '';
		return is_string( $api_key ) ? trim( $api_key ) : '';
	}
}
