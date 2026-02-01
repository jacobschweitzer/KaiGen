<?php
/**
 * Shared helpers for prompt variant generators.
 *
 * @package KaiGen
 */

namespace KaiGen;

use WP_Error;

/**
 * Common prompt and sanitization helpers.
 */
trait Prompt_Variant_Generator_Helpers {
	/**
	 * Builds the system prompt used for prompt variants.
	 *
	 * @return string System prompt.
	 */
	private function get_system_prompt() {
		return implode(
			"\n",
			[
				'Create two image prompt variants in JSON only.',
				'Return valid JSON with keys: detailed_variant, creative_variant.',
				'Detailed variant: preserve subject and intent; add specific visual details (materials, textures, lighting quality, color palette, depth cues, lens style) and vary composition slightly.',
				'Creative variant: reinterpret boldly; change style (illustration, photography, 3D render, collage), shift perspective or scale, alter time of day or season, or add a surreal twist while keeping the core subject recognizable.',
				'Each variant must be a complete image prompt, not a fragment. Return JSON on a single line with no extra text.',
			]
		);
	}

	/**
	 * Parses and sanitizes a prompt variant response.
	 *
	 * @param string $content Raw model output.
	 * @return array|WP_Error Parsed variants or error.
	 */
	private function parse_variant_response( $content ) {
		$payload = $this->decode_json_payload( $content );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$detailed = $payload['detailed_variant'] ?? $payload['detailed'] ?? '';
		$creative = $payload['creative_variant'] ?? $payload['creative'] ?? '';

		$detailed = $this->sanitize_variant( $detailed );
		$creative = $this->sanitize_variant( $creative );

		if ( '' === $detailed || '' === $creative ) {
			return new WP_Error( 'invalid_variant_response', 'Prompt variant response is missing required fields.' );
		}

		return [
			'detailed_variant' => $detailed,
			'creative_variant' => $creative,
		];
	}

	/**
	 * Sanitizes a single variant.
	 *
	 * @param string $variant Raw variant.
	 * @return string Sanitized variant.
	 */
	private function sanitize_variant( $variant ) {
		$variant = trim( (string) $variant, "\" \n\r\t" );
		return sanitize_text_field( $variant );
	}

	/**
	 * Attempts to decode JSON from model output.
	 *
	 * @param string $content Raw model output.
	 * @return array|WP_Error JSON payload or error.
	 */
	private function decode_json_payload( $content ) {
		if ( ! is_string( $content ) ) {
			return new WP_Error( 'invalid_variant_response', 'Prompt variant response was not valid.' );
		}

		$content = trim( $content );
		$payload = json_decode( $content, true );
		if ( is_array( $payload ) ) {
			return $payload;
		}

		if ( preg_match( '/\{.*\}/s', $content, $matches ) ) {
			$payload = json_decode( $matches[0], true );
			if ( is_array( $payload ) ) {
				return $payload;
			}
		}

		return new WP_Error( 'invalid_variant_response', 'Prompt variant response was not valid JSON.' );
	}
}
