<?php
/**
 * Prompt variant generator interface.
 *
 * @package KaiGen
 */

namespace KaiGen;

/**
 * Interface for prompt variant generators.
 */
interface Prompt_Variant_Generator_Core {
	/**
	 * Generates detailed and creative prompt variants.
	 *
	 * @param string $prompt The base prompt.
	 * @return array|WP_Error Array with variants or error on failure.
	 */
	public function generate( $prompt );
}
