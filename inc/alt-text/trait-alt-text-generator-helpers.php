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
				'You write concise alt text for images.',
				'Return a single sentence, 20-30 words.',
				'Include key subject, setting, and any notable action.',
				'Do not include quotes or the phrase "image of".',
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
