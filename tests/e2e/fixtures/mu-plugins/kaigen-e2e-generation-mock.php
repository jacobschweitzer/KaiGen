<?php
/**
 * Mocks the AI Client result for deterministic KaiGen E2E tests.
 *
 * @package KaiGen
 */

add_filter(
	'kaigen_pre_generate_image_result',
	function ( $result, $prompt, $orientation, $provider ) {
		if ( ! defined( 'E2E_TESTING' ) || ! E2E_TESTING ) {
			return $result;
		}

		if ( 'subject' !== $prompt || 'square' !== $orientation || 'auto' !== $provider ) {
			return new WP_Error(
				'e2e_generation_request_mismatch',
				'KaiGen did not pass the expected generation request to the AI Client boundary.',
				[ 'status' => 500 ]
			);
		}

		return new class() implements JsonSerializable {
			/**
			 * Gets the deterministic image file result.
			 *
			 * @return object Image file result.
			 */
			public function to_file() {
				return new class() {
					/**
					 * Gets the deterministic image data URI.
					 *
					 * @return string Image data URI.
					 */
					public function get_data_uri() {
						return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
					}
				};
			}

			/**
			 * Serializes deterministic provider metadata.
			 *
			 * @return array Result metadata.
			 */
			public function jsonSerialize() {
				return [
					'provider_metadata' => [
						'provider' => 'e2e-alpha',
					],
					'model_metadata'    => [
						'model' => 'e2e-image-model',
					],
				];
			}
		};
	},
	0,
	4
);
