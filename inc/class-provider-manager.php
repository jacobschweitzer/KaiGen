<?php
/**
 * Class that manages all AI image provider instances and their registration.
 */
class KaiGen_Provider_Manager {
    /**
     * Holds the singleton instance of this class.
     * @var KaiGen_Provider_Manager
     */
    private static $instance = null;

    /**
     * Stores all registered provider instances in a static array to persist across multiple instances.
     * @var array
     */
    private static $providers = [];

    /**
     * Tracks whether providers have been loaded to prevent multiple loading attempts.
     * @var boolean
     */
    private static $providers_loaded = false;

    /**
     * Private constructor to prevent direct instantiation.
     */
    private function __construct() {
        // Only load providers if they haven't been loaded yet
        if (!self::$providers_loaded) {
            $this->load_providers();
            self::$providers_loaded = true;
        }
    }

    /**
     * Gets the singleton instance of the provider manager.
     * @return KaiGen_Provider_Manager The singleton instance.
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Loads and instantiates all provider classes from the providers directory.
     */
    private function load_providers() {
        // Get the full path to the providers directory
        $providers_dir = plugin_dir_path(dirname(__FILE__)) . 'inc/providers/';

        // Get all PHP files in the providers directory
        $provider_files = glob($providers_dir . 'class-image-provider-*.php');
        
        if (empty($provider_files)) {
            kaigen_debug_log("No provider files found in directory");
            return;
        }

        foreach ($provider_files as $provider_file) {
            require_once $provider_file;
            
            // Extract the class name from the filename
            // Convert filename like 'class-image-provider-replicate.php' to 'KaiGen_Image_Provider_Replicate'
            $class_name = str_replace(['class-', '-'], ['KaiGen_', '_'], basename($provider_file, '.php'));
            
            if (class_exists($class_name)) {
                // Create a new instance with default empty values
                $provider_instance = new $class_name('', '');
                if ($provider_instance instanceof KaiGen_Image_Provider_Interface) {
                    self::$providers[$provider_instance->get_id()] = $provider_instance;
                }
            }
        }
    }

    /**
     * Gets all registered providers.
     * @return array Associative array of provider instances.
     */
    public function get_providers() {
        return self::$providers;
    }

    /**
     * Gets all registered providers as id => name pairs.
     * @return array Associative array of provider IDs and names.
     */
    public function get_provider_list() {
        $provider_list = [];
        foreach (self::$providers as $provider) {
            $provider_list[$provider->get_id()] = $provider->get_name();
        }
        return $provider_list;
    }

    /**
     * Gets a specific provider instance by ID.
     * @param string $provider_id The ID of the provider to get.
     * @return KaiGen_Image_Provider_Interface|null The provider instance or null if not found.
     */
    public function get_provider($provider_id) {
        return isset(self::$providers[$provider_id]) ? self::$providers[$provider_id] : null;
    }
    
    /**
     * Checks if a provider supports image-to-image generation with its current model.
     * @param string $provider_id The ID of the provider to check.
     * @return bool True if the provider supports image-to-image, false otherwise.
     */
    public function provider_supports_image_to_image($provider_id) {
        $provider = $this->get_provider($provider_id);
        if (!$provider) {
            return false;
        }
        
        // Get provider's current model
        $provider_models = get_option('kaigen_provider_models', []);
        $api_keys = get_option('kaigen_provider_api_keys', []);
        
        // Check if we have a valid API key and model set
        if (!isset($api_keys[$provider_id]) || empty($api_keys[$provider_id])) {
            return false;
        }
        
        $model = isset($provider_models[$provider_id]) ? $provider_models[$provider_id] : '';
        
        // Create a new instance with the current API key and model
        $provider_class = get_class($provider);
        $provider_instance = new $provider_class($api_keys[$provider_id], $model);
        
        return $provider_instance->supports_image_to_image();
    }
    
    /**
     * Gets a list of all providers that support image-to-image generation.
     * @return array Array of provider IDs that support image-to-image.
     */
    public function get_image_to_image_providers() {
        $image_to_image_providers = [];
        
        foreach (self::$providers as $provider_id => $provider) {
            if ($this->provider_supports_image_to_image($provider_id)) {
                $image_to_image_providers[] = $provider_id;
            }
        }
        
        return $image_to_image_providers;
    }
}

function kaigen_provider_manager() {
    return KaiGen_Provider_Manager::get_instance();
}

kaigen_provider_manager();

function kaigen_get_providers() {
    static $provider_list = null;
    if (null === $provider_list) {
        $provider_manager = kaigen_provider_manager();
        $provider_list = $provider_manager->get_provider_list();
    }
    return $provider_list;
}
