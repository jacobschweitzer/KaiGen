<?php
/**
 * Alt text generator interface.
 *
 * @package KaiGen
 */

namespace KaiGen;

/**
 * Interface for alt text generators.
 */
interface Alt_Text_Generator_Core {
	/**
	 * Generates alt text for an image.
	 *
	 * @param string $prompt The prompt describing the image.
	 * @param string $image_data_url Base64 data URL of the image.
	 * @return string|WP_Error Alt text or error on failure.
	 */
	public function generate( $prompt, $image_data_url = '' );
}
