<?php
/**
 * Behavioral tests for the image generation service.
 *
 * @package KaiGen
 */

namespace KaiGen\Tests\PHP;

use KaiGen\Image_Generation_Service;
use PHPUnit\Framework\TestCase;
use WP_Error;

require_once KAIGEN_TESTS_ROOT . '/tests/php/stubs/class-wp-error.php';
require_once KAIGEN_TESTS_ROOT . '/tests/php/stubs/kaigen-functions.php';
require_once KAIGEN_TESTS_ROOT . '/inc/class-image-generation-service.php';

/**
 * Tests image generation service dependency fallbacks.
 */
final class ImageGenerationServiceTest extends TestCase {
	/**
	 * Tests that a null pre-generation result preserves the unavailable-client error.
	 *
	 * @return void
	 */
	public function test_null_pre_generation_result_preserves_unavailable_client_error() {
		$request = new class() {
			/**
			 * Gets a generation request parameter.
			 *
			 * @param string $name Parameter name.
			 * @return mixed Parameter value.
			 */
			public function get_param( $name ) {
				$params = [
					'prompt'           => 'subject',
					'provider'         => 'auto',
					'orientation'      => 'square',
					'source_image_ids' => [],
				];

				return $params[ $name ] ?? null;
			}
		};

		$result = ( new Image_Generation_Service() )->generate_from_request( $request );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'ai_client_unavailable', $result->get_error_code() );
		$this->assertSame( 501, $result->get_error_data()['status'] );
	}
}
