<?php
/**
 * Utility functions for the plugin.
 * @package KaiGen
 */

/**
 * Logs debug information if KAIGEN_DEBUG_LOG is set to true.
 *
 * @param string $message The message to log.
 */
function kaigen_debug_log($message) {
	if (defined('KAIGEN_DEBUG_LOG') && KAIGEN_DEBUG_LOG) {
		error_log('[KaiGen] ' . $message);
	}
}
