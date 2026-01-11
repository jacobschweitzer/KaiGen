<?php
/**
 * Provider Manager Class
 *
 * @package KaiGen
 */

namespace KaiGen;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class that manages all AI image provider instances and their registration.
 */
class Provider_Manager {
	/**
	 * Holds the singleton instance of this class.
	 *
	 * @var Provider_Manager
	 */
	private static $instance = null;

	/**
	 * Stores all registered provider instances in a static array to persist across multiple instances.
	 *
	 * @var array
	 */
	private static $providers = [];

	/**
	 * Tracks whether providers have been loaded to prevent multiple loading attempts.
	 *
	 * @var boolean
	 */
	private static $providers_loaded = false;

	/**
	 * Cached alt text generator class name.
	 *
	 * @var string|null
	 */
	private static $alt_text_generator_class = null;

	/**
	 * Private constructor to prevent direct instantiation.
	 */
	private function __construct() {
		// Only load providers if they haven't been loaded yet.
		if ( ! self::$providers_loaded ) {
			$this->load_providers();
			self::$providers_loaded = true;
		}
	}

	/**
	 * Gets the singleton instance of the provider manager.
	 *
	 * @return Provider_Manager The singleton instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Loads and instantiates all provider classes from the providers directory.
	 */
	private function load_providers() {
		// Get the full path to the providers directory.
		$providers_dir = plugin_dir_path( __DIR__ ) . 'inc/providers/';

		// Get all PHP files in the providers directory.
		$provider_files = glob( $providers_dir . 'class-image-provider-*.php' );

		if ( empty( $provider_files ) ) {
			return;
		}

		foreach ( $provider_files as $provider_file ) {
			require_once $provider_file;

			// Extract the class name from the filename.
			// Convert filename like 'class-image-provider-replicate.php' to 'KaiGen\Providers\Image_Provider_Replicate'.
			$filename = basename( $provider_file, '.php' );
			// Remove 'class-image-provider-' prefix to get the provider name (e.g., 'openai', 'replicate').
			$provider_name = str_replace( 'class-image-provider-', '', $filename );
			// Convert to proper case - handle special cases like 'openai' -> 'OpenAI'.
			$provider_name = $this->format_provider_name( $provider_name );
			// Build the full class name.
			$base_class_name = 'Image_Provider_' . $provider_name;
			$class_name      = 'KaiGen\Providers\\' . $base_class_name;

			if ( class_exists( $class_name ) ) {
				// Create a new instance with default empty values.
				$provider_instance = new $class_name( '', '' );
				if ( $provider_instance instanceof \KaiGen\Image_Provider_Interface ) {
					self::$providers[ $provider_instance->get_id() ] = $provider_instance;
				}
			}
		}
	}

	/**
	 * Gets all registered providers.
	 *
	 * @return array Associative array of provider instances.
	 */
	public function get_providers() {
		return self::$providers;
	}

	/**
	 * Gets all registered providers as id => name pairs.
	 *
	 * @return array Associative array of provider IDs and names.
	 */
	public function get_provider_list() {
		$provider_list = [];
		foreach ( self::$providers as $provider ) {
			$provider_list[ $provider->get_id() ] = $provider->get_name();
		}
		return $provider_list;
	}

	/**
	 * Gets a specific provider instance by ID.
	 *
	 * @param string $provider_id The ID of the provider to get.
	 * @return \KaiGen\Image_Provider_Interface|null The provider instance or null if not found.
	 */
	public function get_provider( $provider_id ) {
		return isset( self::$providers[ $provider_id ] ) ? self::$providers[ $provider_id ] : null;
	}

	/**
	 * Gets the active provider ID based on settings and stored keys.
	 *
	 * @return string Active provider ID or empty string if none configured.
	 */
	public function get_active_provider_id() {
		$provider = get_option( 'kaigen_provider', '' );
		if ( '' !== $provider ) {
			return strtolower( trim( (string) $provider ) );
		}

		$api_keys = get_option( 'kaigen_provider_api_keys', [] );
		if ( ! empty( $api_keys['openai'] ) ) {
			return 'openai';
		}

		foreach ( $api_keys as $provider_id => $api_key ) {
			if ( ! empty( $api_key ) ) {
				return strtolower( trim( (string) $provider_id ) );
			}
		}

		return '';
	}

	/**
	 * Gets the loaded alt text generator class for the active provider.
	 *
	 * @return string Loaded generator class name or empty string.
	 */
	public function get_active_alt_text_generator_class() {
		$this->load_active_alt_text_generator();

		$active = $this->get_active_provider_id();
		if ( '' === $active ) {
			return '';
		}

		if ( null !== self::$alt_text_generator_class ) {
			return self::$alt_text_generator_class;
		}

		foreach ( get_declared_classes() as $class ) {
			if ( 0 !== strpos( $class, __NAMESPACE__ . '\\' ) ) {
				continue;
			}

			$implements = class_implements( $class );
			if ( empty( $implements ) ) {
				continue;
			}

			if ( in_array( Alt_Text_Generator_Core::class, $implements, true ) ) {
				self::$alt_text_generator_class = $class;
				return $class;
			}
		}

		self::$alt_text_generator_class = '';
		return '';
	}

	/**
	 * Loads the active alt text generator class file when available.
	 *
	 * @return void
	 */
	private function load_active_alt_text_generator() {
		$provider = $this->get_active_provider_id();
		if ( '' === $provider ) {
			return;
		}

		$provider = sanitize_key( $provider );
		$base_dir = plugin_dir_path( __DIR__ ) . 'inc/alt-text/';

		require_once $base_dir . 'trait-alt-text-generator-helpers.php';

		$class_file = $base_dir . 'class-alt-text-generator-' . $provider . '.php';
		if ( file_exists( $class_file ) ) {
			require_once $class_file;
		}
	}

	/**
	 * Formats a provider name from filename format to class name format.
	 *
	 * Allows providers to filter the formatted name using the 'kaigen_format_provider_name' filter.
	 *
	 * @param string $name The provider name from filename (e.g., 'openai', 'replicate').
	 * @return string The formatted provider name (e.g., 'OpenAI', 'Replicate').
	 */
	private function format_provider_name( $name ) {
		$name_lower = strtolower( $name );

		// Default: capitalize first letter.
		$formatted_name = ucfirst( $name );

		/**
		 * Filters the formatted provider name.
		 *
		 * Allows providers to customize their display name format.
		 *
		 * @param string $formatted_name The formatted provider name.
		 * @param string $name            The original provider name from filename.
		 * @param string $name_lower      The lowercase version of the provider name.
		 */
		return apply_filters( 'kaigen_format_provider_name', $formatted_name, $name, $name_lower );
	}
}

// phpcs:disable Universal.Files.SeparateFunctionsFromOO.Mixed -- Helper functions for singleton pattern is a common WordPress practice.
/**
 * Gets the singleton instance of the provider manager.
 *
 * @return \KaiGen\Provider_Manager The provider manager instance.
 */
function kaigen_provider_manager() {
	return \KaiGen\Provider_Manager::get_instance();
}

kaigen_provider_manager();

/**
 * Gets all registered providers as id => name pairs.
 *
 * @return array Associative array of provider IDs and names.
 */
function kaigen_get_providers() {
	static $provider_list = null;
	if ( null === $provider_list ) {
		$provider_manager = kaigen_provider_manager();
		$provider_list    = $provider_manager->get_provider_list();
	}
	return $provider_list;
}
// phpcs:enable Universal.Files.SeparateFunctionsFromOO.Mixed
