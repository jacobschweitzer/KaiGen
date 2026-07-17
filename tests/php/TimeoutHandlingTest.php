<?php
/**
 * Regression tests for image generation timeout ownership.
 *
 * @package KaiGen
 */

namespace KaiGen\Tests\PHP;

use PHPUnit\Framework\TestCase;

/**
 * Tests timeout handling ownership across the bootstrap and service layer.
 */
final class TimeoutHandlingTest extends TestCase {
	/**
	 * Tests that OpenAI-specific timeout handling is not registered globally.
	 *
	 * @return void
	 */
	public function test_bootstrap_does_not_register_openai_specific_timeout_handling() {
		$this->assertStringNotContainsString(
			'OpenAI_Image_Generation_HTTP_Options',
			$this->get_kaigen_bootstrap(),
			'OpenAI-specific HTTP timeout handling should not be registered from the plugin bootstrap.'
		);

		$this->assertStringNotContainsString(
			'class-openai-image-generation-http-options.php',
			$this->get_kaigen_bootstrap(),
			'OpenAI-specific HTTP timeout handling should not be loaded by the plugin bootstrap.'
		);
	}

	/**
	 * Tests that generic HTTP timeout retry support is loaded.
	 *
	 * @return void
	 */
	public function test_bootstrap_loads_generic_timeout_retry_options() {
		$this->assertStringContainsString(
			'class-image-generation-http-options.php',
			$this->get_kaigen_bootstrap(),
			'Conditional HTTP/cURL retry options should be loaded by the plugin bootstrap.'
		);
	}

	/**
	 * Tests that the service owns the timeout retry lifecycle.
	 *
	 * @return void
	 */
	public function test_image_generation_service_owns_timeout_retry_lifecycle() {
		$this->assertStringContainsString(
			'wp_ai_client_default_request_timeout',
			$this->get_kaigen_service(),
			'Image_Generation_Service should keep applying the AI Client request timeout during image generation.'
		);

		$this->assertStringContainsString(
			'is_retryable_timeout_error',
			$this->get_kaigen_service(),
			'Image_Generation_Service should only retry with lower-level HTTP options after timeout-like failures.'
		);

		$this->assertStringContainsString(
			'Image_Generation_HTTP_Options',
			$this->get_kaigen_service(),
			'Image_Generation_Service should own the conditional HTTP/cURL retry lifecycle.'
		);
	}

	/**
	 * Tests that a null pre-generation result preserves the unavailable-client error.
	 *
	 * @return void
	 */
	public function test_pre_generation_filter_preserves_unavailable_client_error() {
		$service = $this->get_kaigen_service();

		$this->assertStringNotContainsString(
			"has_filter( 'kaigen_pre_generate_image_result' )",
			$service,
			'Filter registration priority must not determine whether the AI Client is available.'
		);

		$filter_position       = strpos( $service, "apply_filters(\n\t\t\t'kaigen_pre_generate_image_result'" );
		$availability_position = strpos( $service, "function_exists( 'wp_ai_client_prompt' )", $filter_position );

		$this->assertIsInt( $filter_position );
		$this->assertIsInt( $availability_position );
		$this->assertLessThan(
			$availability_position,
			$filter_position,
			'A null pre-generation result should fall through to the existing unavailable-client error before building a prompt.'
		);
	}

	/**
	 * Tests that media-library reference images require attachment edit access.
	 *
	 * @return void
	 */
	public function test_reference_attachment_images_require_edit_post_capability() {
		$this->assertStringContainsString(
			"current_user_can( 'edit_post', \$attachment_id )",
			$this->get_kaigen_service(),
			'Image_Generation_Service should verify attachment ownership before sending media-library reference images to providers.'
		);
	}

	/**
	 * Tests that URL-only reference images are not accepted by the REST API.
	 *
	 * @return void
	 */
	public function test_rest_api_does_not_accept_url_only_reference_images() {
		$this->assertStringNotContainsString(
			'source_image_urls',
			$this->get_kaigen_rest_api(),
			'Reference images should be submitted by attachment ID only.'
		);
	}

	/**
	 * Tests that URL-only reference images are not downloaded by the service.
	 *
	 * @return void
	 */
	public function test_image_generation_service_does_not_download_url_only_reference_images() {
		$this->assertStringNotContainsString(
			'download_url',
			$this->get_kaigen_service(),
			'Image_Generation_Service should attach reference images from attachment IDs only.'
		);
	}

	/**
	 * Tests that retry options preserve cURL low-speed handling.
	 *
	 * @return void
	 */
	public function test_retry_options_preserve_curl_low_speed_handling() {
		$this->assertStringContainsString(
			'CURLOPT_LOW_SPEED_LIMIT',
			$this->get_kaigen_http_options(),
			'Conditional retry options should preserve cURL low-speed handling.'
		);
	}

	/**
	 * Gets plugin bootstrap contents.
	 *
	 * @return string
	 */
	private function get_kaigen_bootstrap() {
		return $this->read_repository_file( 'kaigen.php' );
	}

	/**
	 * Gets image generation service contents.
	 *
	 * @return string
	 */
	private function get_kaigen_service() {
		return $this->read_repository_file( 'inc/class-image-generation-service.php' );
	}

	/**
	 * Gets REST API contents.
	 *
	 * @return string
	 */
	private function get_kaigen_rest_api() {
		return $this->read_repository_file( 'inc/class-rest-api.php' );
	}

	/**
	 * Gets image generation HTTP options contents.
	 *
	 * @return string
	 */
	private function get_kaigen_http_options() {
		return $this->read_repository_file( 'inc/class-image-generation-http-options.php' );
	}

	/**
	 * Reads a repository file.
	 *
	 * @param string $path Repository-relative file path.
	 * @return string
	 */
	private function read_repository_file( $path ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local regression test reads repository files.
		$contents = file_get_contents( KAIGEN_TESTS_ROOT . '/' . $path );

		$this->assertIsString( $contents );

		return $contents;
	}
}
