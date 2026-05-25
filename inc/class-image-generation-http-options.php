<?php
/**
 * Conditional image generation HTTP options for KaiGen.
 *
 * @package KaiGen
 */

namespace KaiGen;

/**
 * Applies lower-level HTTP options for a retry after timeout-like failures.
 */
final class Image_Generation_HTTP_Options {
	/**
	 * Connection timeout for image generation requests, in seconds.
	 *
	 * @var int
	 */
	private const IMAGE_GENERATION_CONNECT_TIMEOUT = 30;

	/**
	 * Minimum transfer rate before cURL aborts image generation, in bytes per second.
	 *
	 * @var int
	 */
	private const IMAGE_GENERATION_LOW_SPEED_LIMIT = 1;

	/**
	 * Time below the low-speed limit before cURL aborts image generation, in seconds.
	 *
	 * @var int
	 */
	private const IMAGE_GENERATION_LOW_SPEED_TIME = 180;

	/**
	 * Timeout for image generation requests, in seconds.
	 *
	 * @var int
	 */
	private $timeout;

	/**
	 * Constructor.
	 *
	 * @param int $timeout Timeout in seconds.
	 */
	public function __construct( $timeout ) {
		$this->timeout = absint( $timeout );
	}

	/**
	 * Registers HTTP filters for an active retry.
	 *
	 * @return void
	 */
	public function register() {
		add_filter( 'http_request_args', [ $this, 'filter_image_generation_request_args' ], 10, 2 );
		add_action( 'http_api_curl', [ $this, 'apply_image_generation_curl_options' ], 10, 3 );
	}

	/**
	 * Unregisters HTTP filters after an active retry.
	 *
	 * @return void
	 */
	public function unregister() {
		remove_filter( 'http_request_args', [ $this, 'filter_image_generation_request_args' ], 10 );
		remove_action( 'http_api_curl', [ $this, 'apply_image_generation_curl_options' ], 10 );
	}

	/**
	 * Raises WordPress HTTP API timeouts during the retry.
	 *
	 * @param array  $args Request arguments.
	 * @param string $url Request URL.
	 * @return array Filtered request arguments.
	 */
	public function filter_image_generation_request_args( $args, $url ) {
		unset( $url );

		$args['timeout'] = max( (int) ( $args['timeout'] ?? 0 ), $this->timeout );

		return $args;
	}

	/**
	 * Applies cURL options for slow image generation responses during the retry.
	 *
	 * @param resource|\CurlHandle $handle cURL handle.
	 * @param array                $request_args Request arguments.
	 * @param string               $url Request URL.
	 * @return void
	 */
	public function apply_image_generation_curl_options( $handle, $request_args, $url ) {
		unset( $url );

		$timeout = max( (int) ( $request_args['timeout'] ?? 0 ), $this->timeout );

		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_TIMEOUT, $timeout );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_CONNECTTIMEOUT, self::IMAGE_GENERATION_CONNECT_TIMEOUT );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_LOW_SPEED_LIMIT, self::IMAGE_GENERATION_LOW_SPEED_LIMIT );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_LOW_SPEED_TIME, self::IMAGE_GENERATION_LOW_SPEED_TIME );
	}
}
