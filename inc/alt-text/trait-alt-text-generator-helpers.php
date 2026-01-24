<?php
/**
 * Shared helpers for alt text generators.
 *
 * @package KaiGen
 */

namespace KaiGen;

/**
 * Common prompt and sanitization helpers.
 */
trait Alt_Text_Generator_Helpers {
	/**
	 * Builds the system prompt used for alt text generation.
	 *
	 * @return string System prompt.
	 */
	private function get_system_prompt() {
		return implode(
			"\n",
			[
				'You write helpful, accurate alt text for screen readers.',
				'Return one sentence of 20-30 words in plain language.',
				'Describe the most important visual information: primary subject, relevant details (count, condition, notable colors), setting, and action.',
				'Include any visible on-image text only if it is essential to understanding the image.',
				'Do not start with "image of", "photo of", or quotes; do not include filenames, camera metadata, hashtags, or speculation.',
				'If the subject is unclear, focus on obvious visible elements without guessing.',
			]
		);
	}

	/**
	 * Sanitizes alt text output.
	 *
	 * @param string $content Raw model output.
	 * @return string Sanitized alt text.
	 */
	private function sanitize_alt_text( $content ) {
		$content = trim( (string) $content, "\" \n\r\t" );
		return sanitize_text_field( $content );
	}
}
