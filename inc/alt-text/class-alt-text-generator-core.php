<?php
/**
 * Core alt text generator helpers.
 *
 * @package KaiGen
 */

namespace KaiGen;

/**
 * Interface for alt text generators.
 */
interface Alt_Text_Generator_Interface {
	/**
	 * Generates alt text using a provider.
	 *
	 * @param string $prompt The prompt describing the image.
	 * @param string $image_data_url Base64 data URL of the image.
	 * @return string|WP_Error Alt text or error on failure.
	 */
	public function generate( $prompt, $image_data_url = '' );
}

/**
 * Shared helpers for alt text generators.
 */
abstract class Alt_Text_Generator_Core implements Alt_Text_Generator_Interface {
	/**
	 * Registers default alt text generator classes.
	 *
	 * @return void
	 */
	public static function register_filters() {
		add_filter(
			'kaigen_alt_text_generator_class',
			function ( $class, $provider ) {
				$provider = strtolower( trim( (string) $provider ) );

				$map = [
					'openai'    => Alt_Text_Generator_OpenAI::class,
					'replicate' => Alt_Text_Generator_Replicate::class,
				];

				return $map[ $provider ] ?? $class;
			},
			10,
			2
		);
	}
	/**
	 * Builds the system prompt used for alt text generation.
	 *
	 * @return string System prompt.
	 */
	protected function get_system_prompt() {
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
	protected function sanitize_alt_text( $content ) {
		$content = trim( (string) $content, "\" \n\r\t" );
		return sanitize_text_field( $content );
	}

}

Alt_Text_Generator_Core::register_filters();
