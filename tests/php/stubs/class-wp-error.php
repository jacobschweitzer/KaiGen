<?php
/**
 * Minimal WordPress error implementation for service tests.
 *
 * @package KaiGen
 */

if ( ! class_exists( 'WP_Error' ) ) {
	/**
	 * Stores an error code and error data.
	 */
	class WP_Error {
		/**
		 * Error code.
		 *
		 * @var string
		 */
		private $code;

		/**
		 * Error data.
		 *
		 * @var mixed
		 */
		private $data;

		/**
		 * Creates an error.
		 *
		 * @param string $code Error code.
		 * @param string $message Error message.
		 * @param mixed  $data Error data.
		 */
		public function __construct( $code, $message = '', $data = null ) {
			$this->code = $code;
			$this->data = $data;
		}

		/**
		 * Gets the error code.
		 *
		 * @return string Error code.
		 */
		public function get_error_code() {
			return $this->code;
		}

		/**
		 * Gets the error data.
		 *
		 * @return mixed Error data.
		 */
		public function get_error_data() {
			return $this->data;
		}
	}
}
