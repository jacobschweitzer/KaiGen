<?php
/**
 * WordPress function stubs for KaiGen service tests.
 *
 * @package KaiGen
 */

namespace KaiGen;

if ( ! function_exists( __NAMESPACE__ . '\\sanitize_key' ) ) {
	/**
	 * Sanitizes a test request key.
	 *
	 * @param string $value Raw value.
	 * @return string Sanitized value.
	 */
	function sanitize_key( $value ) {
		return strtolower( preg_replace( '/[^a-zA-Z0-9_-]/', '', $value ) );
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\apply_filters' ) ) {
	/**
	 * Returns the unmodified test filter value.
	 *
	 * @param string $hook_name Filter name.
	 * @param mixed  $value Filter value.
	 * @return mixed Filter value.
	 */
	function apply_filters( $hook_name, $value ) {
		return $value;
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\__' ) ) {
	/**
	 * Returns an untranslated test string.
	 *
	 * @param string $text Text to translate.
	 * @return string Original text.
	 */
	function __( $text ) {
		return $text;
	}
}
