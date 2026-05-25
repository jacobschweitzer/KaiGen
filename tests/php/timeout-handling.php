<?php
/**
 * Regression checks for image generation timeout ownership.
 *
 * @package KaiGen
 */

$kaigen_root = dirname( __DIR__, 2 );

// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local regression test reads repository files.
$kaigen_bootstrap = file_get_contents( $kaigen_root . '/kaigen.php' );
// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local regression test reads repository files.
$kaigen_service = file_get_contents( $kaigen_root . '/inc/class-image-generation-service.php' );
// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local regression test reads repository files.
$kaigen_http_options = file_get_contents( $kaigen_root . '/inc/class-image-generation-http-options.php' );

assert( false !== $kaigen_bootstrap );
assert( false !== $kaigen_service );
assert( false !== $kaigen_http_options );

assert(
	false === strpos( $kaigen_bootstrap, 'OpenAI_Image_Generation_HTTP_Options' ),
	'OpenAI-specific HTTP timeout handling should not be registered from the plugin bootstrap.'
);

assert(
	false === strpos( $kaigen_bootstrap, 'class-openai-image-generation-http-options.php' ),
	'OpenAI-specific HTTP timeout handling should not be loaded by the plugin bootstrap.'
);

assert(
	false !== strpos( $kaigen_bootstrap, 'class-image-generation-http-options.php' ),
	'Conditional HTTP/cURL retry options should be loaded by the plugin bootstrap.'
);

assert(
	false !== strpos( $kaigen_service, 'wp_ai_client_default_request_timeout' ),
	'Image_Generation_Service should keep applying the AI Client request timeout during image generation.'
);

assert(
	false !== strpos( $kaigen_service, 'is_retryable_timeout_error' ),
	'Image_Generation_Service should only retry with lower-level HTTP options after timeout-like failures.'
);

assert(
	false !== strpos( $kaigen_service, 'Image_Generation_HTTP_Options' ),
	'Image_Generation_Service should own the conditional HTTP/cURL retry lifecycle.'
);

assert(
	false !== strpos( $kaigen_http_options, 'CURLOPT_LOW_SPEED_LIMIT' ),
	'Conditional retry options should preserve cURL low-speed handling.'
);
