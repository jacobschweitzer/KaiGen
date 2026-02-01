<?php
/**
 * OpenAI prompt variant generator.
 *
 * @package KaiGen
 */

namespace KaiGen;

use WP_Error;

/**
 * Generates prompt variants using OpenAI.
 */
class Prompt_Variant_Generator_OpenAI implements Prompt_Variant_Generator_Core {
	use Prompt_Variant_Generator_Helpers;

	/**
	 * OpenAI API URL for responses.
	 *
	 * @var string
	 */
	private const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

	/**
	 * OpenAI model used for prompt variants.
	 *
	 * @var string
	 */
	private const OPENAI_MODEL = 'gpt-5.2';

	/**
	 * Generates prompt variants using OpenAI.
	 *
	 * @param string $prompt The base prompt.
	 * @return array|WP_Error Prompt variants or error on failure.
	 */
	public function generate( $prompt ) {
		$prompt = sanitize_textarea_field( (string) $prompt );
		if ( '' === $prompt ) {
			return new WP_Error( 'invalid_prompt', 'Prompt is required for prompt variants.', [ 'status' => 400 ] );
		}

		$api_key = $this->get_api_key();
		if ( '' === $api_key ) {
			return new WP_Error(
				'missing_openai_key',
				'OpenAI API key is required for prompt variants.',
				[ 'status' => 400 ]
			);
		}

		$request_body = [
			'model' => self::OPENAI_MODEL,
			'input' => [
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
			return new WP_Error( 'openai_error', 'Prompt variant generation failed: ' . $response->get_error_message() );
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
		$variants         = $this->parse_variant_response( $content );
		if ( is_wp_error( $variants ) ) {
			return $variants;
		}

		return $variants;
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
