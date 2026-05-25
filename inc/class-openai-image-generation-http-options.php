<?php
/**
 * OpenAI image generation HTTP options for KaiGen.
 *
 * @package KaiGen
 */

namespace KaiGen;

/**
 * Applies OpenAI-specific HTTP options for long-running image requests.
 */
final class OpenAI_Image_Generation_HTTP_Options {
	/**
	 * Default timeout for image generation requests, in seconds.
	 *
	 * @var int
	 */
	private const IMAGE_GENERATION_TIMEOUT = 180;

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
	 * Registers integration hooks.
	 *
	 * @return void
	 */
	public function register_hooks() {
		add_action( 'kaigen_before_image_generation_request', [ $this, 'register' ] );
		add_action( 'kaigen_after_image_generation_request', [ $this, 'unregister' ] );
	}

	/**
	 * Registers HTTP filters for an active image generation request.
	 *
	 * @return void
	 */
	public function register() {
		add_filter( 'http_request_args', [ $this, 'filter_image_generation_request_args' ], 10, 2 );
		add_action( 'http_api_curl', [ $this, 'apply_image_generation_curl_options' ], 10, 3 );
	}

	/**
	 * Unregisters HTTP filters after an image generation request.
	 *
	 * @return void
	 */
	public function unregister() {
		remove_filter( 'http_request_args', [ $this, 'filter_image_generation_request_args' ], 10 );
		remove_action( 'http_api_curl', [ $this, 'apply_image_generation_curl_options' ], 10 );
	}

	/**
	 * Raises WordPress HTTP API timeouts for OpenAI image generation requests.
	 *
	 * @param array  $args Request arguments.
	 * @param string $url Request URL.
	 * @return array Filtered request arguments.
	 */
	public function filter_image_generation_request_args( $args, $url ) {
		if ( ! $this->is_openai_image_generation_url( $url ) ) {
			return $args;
		}

		$args['timeout'] = max( (int) ( $args['timeout'] ?? 0 ), self::IMAGE_GENERATION_TIMEOUT );

		return $args;
	}

	/**
	 * Applies cURL options for slow OpenAI image generation responses.
	 *
	 * @param resource|\CurlHandle $handle cURL handle.
	 * @param array                $request_args Request arguments.
	 * @param string               $url Request URL.
	 * @return void
	 */
	public function apply_image_generation_curl_options( $handle, $request_args, $url ) {
		if ( ! $this->is_openai_image_generation_url( $url ) ) {
			return;
		}

		$timeout = max( (int) ( $request_args['timeout'] ?? 0 ), self::IMAGE_GENERATION_TIMEOUT );

		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_TIMEOUT, $timeout );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_CONNECTTIMEOUT, self::IMAGE_GENERATION_CONNECT_TIMEOUT );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_LOW_SPEED_LIMIT, self::IMAGE_GENERATION_LOW_SPEED_LIMIT );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt -- Required to override cURL low-speed aborts for long image requests.
		curl_setopt( $handle, CURLOPT_LOW_SPEED_TIME, self::IMAGE_GENERATION_LOW_SPEED_TIME );
	}

	/**
	 * Checks whether a URL is an OpenAI image generation endpoint.
	 *
	 * @param string $url Request URL.
	 * @return bool True when the URL is an OpenAI image generation endpoint.
	 */
	private function is_openai_image_generation_url( $url ) {
		$url = (string) $url;
		return 0 === strpos( $url, 'https://api.openai.com/v1/images/generations' ) ||
			0 === strpos( $url, 'https://api.openai.com/v1/images/edits' );
	}
}
