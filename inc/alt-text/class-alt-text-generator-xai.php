<?php
/**
 * XAI alt text generator.
 *
 * @package KaiGen
 */

namespace KaiGen;

use WP_Error;

/**
 * Generates alt text using xAI.
 */
class Alt_Text_Generator_XAI implements Alt_Text_Generator_Core {
	use Alt_Text_Generator_Helpers;

	/**
	 * XAI API URL for chat completions.
	 *
	 * @var string
	 */
	private const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

	/**
	 * XAI model used for alt text generation.
	 *
	 * @var string
	 */
	private const XAI_MODEL = 'grok-4-1-fast-reasoning';

	/**
	 * Generates alt text using xAI.
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
				'missing_xai_key',
				'xAI API key is required for alt text generation.',
				[ 'status' => 400 ]
			);
		}

		$request_body = [
			'model'       => apply_filters( 'kaigen_alt_text_xai_model', self::XAI_MODEL ),
			'temperature' => 0.2,
			'messages'    => [
				[
					'role'    => 'system',
					'content' => $this->get_system_prompt(),
				],
				[
					'role'    => 'user',
					'content' => [
						[
							'type'      => 'image_url',
							'image_url' => [
								'url'    => $image_data_url,
								'detail' => 'high',
							],
						],
						[
							'type' => 'text',
							'text' => $prompt,
						],
					],
				],
			],
		];

		$response = wp_remote_post(
			self::XAI_API_URL,
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
			return new WP_Error( 'xai_error', 'Alt text generation failed: ' . $response->get_error_message() );
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		$response_body = wp_remote_retrieve_body( $response );

		if ( 200 !== $response_code ) {
			$error_message = 'xAI API request failed.';
			$decoded_body  = json_decode( $response_body, true );
			if ( isset( $decoded_body['error'] ) && is_string( $decoded_body['error'] ) ) {
				$error_message = $decoded_body['error'];
			} elseif ( isset( $decoded_body['error']['message'] ) ) {
				$error_message = $decoded_body['error']['message'];
			}
			return new WP_Error( 'xai_error', $error_message );
		}

		$decoded_response = json_decode( $response_body, true );
		$content          = $this->extract_response_text( $decoded_response );
		$content          = $this->sanitize_alt_text( $content );

		if ( '' === $content ) {
			return new WP_Error( 'invalid_xai_response', 'xAI response did not include alt text.' );
		}

		return $content;
	}

	/**
	 * Extracts text content from a Chat Completions payload.
	 *
	 * @param array $response Parsed response payload.
	 * @return string Extracted text.
	 */
	private function extract_response_text( $response ) {
		if ( ! is_array( $response ) || empty( $response['choices'][0]['message']['content'] ) ) {
			return '';
		}

		$content = $response['choices'][0]['message']['content'];
		if ( is_string( $content ) ) {
			return $content;
		}

		if ( is_array( $content ) ) {
			$text = '';
			foreach ( $content as $item ) {
				if ( isset( $item['type'], $item['text'] ) && in_array( $item['type'], [ 'text', 'output_text' ], true ) ) {
					$text .= $item['text'];
				}
			}
			return trim( $text );
		}

		return '';
	}

	/**
	 * Retrieves the xAI API key from saved provider settings.
	 *
	 * @return string The API key or empty string if not found.
	 */
	private function get_api_key() {
		$api_keys = get_option( 'kaigen_provider_api_keys', [] );
		$api_key  = isset( $api_keys['xai'] ) ? $api_keys['xai'] : '';
		return is_string( $api_key ) ? trim( $api_key ) : '';
	}
}
