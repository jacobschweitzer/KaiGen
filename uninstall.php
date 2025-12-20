<?php
/**
 * Uninstall script for KaiGen plugin.
 *
 * This file is executed when the plugin is uninstalled from WordPress.
 * It removes all plugin options and data from the database.
 *
 * @package KaiGen
 */

namespace KaiGen;

// If uninstall not called from WordPress, then exit.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/**
 * Delete all KaiGen plugin options from the database.
 */
function kaigen_delete_plugin_options() {
	// List of all options used by the KaiGen plugin.
	$options_to_delete = [
		// Current KaiGen options.
		'kaigen_provider',              // Selected AI provider.
		'kaigen_provider_api_keys',     // API keys for different providers.
		'kaigen_quality_settings',      // Image quality settings.
		'kaigen_provider_models',       // Provider model configurations.
		'kaigen_openai_api_key',        // Legacy OpenAI API key (may still exist).
		'kaigen_quality_setting',       // Legacy quality setting (may still exist).

		// Legacy options from previous plugin version (wp_ai_image_gen_ prefix).
		'wp_ai_image_gen_openai_api_key',    // Legacy OpenAI API key.
		'wp_ai_image_gen_replicate_api_key', // Legacy Replicate API key.
		'wp_ai_image_gen_main_provider',     // Legacy main provider setting.
		'wp_ai_image_gen_provider_api_keys', // Legacy provider API keys.
		'wp_ai_image_gen_quality_settings',  // Legacy quality settings.
		'wp_ai_image_gen_provider_models',   // Legacy provider models.
	];

	// Delete each option.
	foreach ( $options_to_delete as $option ) {
		delete_option( $option );
	}

	// Also delete any site options (for multisite installations).
	foreach ( $options_to_delete as $option ) {
		delete_site_option( $option );
	}
}

// Execute cleanup functions.
kaigen_delete_plugin_options();
