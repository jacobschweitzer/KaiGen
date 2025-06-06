<?php
/**
 * Abstract class for image generation providers.
 *
 * @package KaiGen
 */

abstract class KaiGen_Image_Provider implements KaiGen_Image_Provider_Interface {
    /**
     * The API key for the provider.
     * @var string
     */
    protected $api_key;
    
    /**
     * The selected model for the provider.
     * @var string
     */
    protected $model;

    /**
     * Constructor initializes the provider with API key and model.
     *
     * @param string $api_key The API key for the provider.
     * @param string $model The selected model for image generation.
     */
    public function __construct($api_key, $model) {
        $this->api_key = $api_key;
        $this->model = $model;
    }

    /**
     * Gets the current model being used by the provider.
     *
     * @return string The current model identifier.
     */
    public function get_current_model() {
        return $this->model;
    }

    /**
     * Sets a new model for the provider.
     *
     * @param string $model The new model identifier.
     * @return bool True if the model was successfully set, false otherwise.
     */
    public function set_model($model) {
        if (array_key_exists($model, $this->get_available_models())) {
            $this->model = $model;
            return true;
        }
        return false;
    }
    
    /**
     * Checks if this provider supports image-to-image generation with the current model.
     * By default, providers don't support image-to-image. Override in child classes if supported.
     *
     * @return bool True if image-to-image is supported, false otherwise.
     */
    public function supports_image_to_image() {
        return false;
    }

    /**
     * Prepares the headers for API requests.
     *
     * @return array The headers array for the API request.
     */
    protected function get_request_headers() {
        return [
            'Authorization' => 'Bearer ' . $this->api_key,
            'Content-Type' => 'application/json',
        ];
    }

    /**
     * Validates common parameters for image generation.
     * Child classes should extend this method for provider-specific validation.
     *
     * @param string $prompt The generation prompt.
     * @param array $additional_params Additional parameters.
     * @return true|WP_Error True if valid, WP_Error if invalid.
     */
    protected function validate_parameters($prompt, $additional_params = []) {
        if (empty($prompt)) {
            return new WP_Error('invalid_prompt', 'Prompt cannot be empty');
        }

        if (empty($this->api_key)) {
            return new WP_Error('invalid_api_key', 'API key is not set');
        }

        if (empty($this->model)) {
            return new WP_Error('invalid_model', 'Model is not set');
        }

        if (!$this->validate_api_key()) {
            return new WP_Error('invalid_api_key_format', 'API key format is invalid');
        }

        return true;
    }

    /**
     * Generates an image based on the provided prompt and additional parameters.
     * This method orchestrates the image generation process.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The generated image data or error.
     */
    public function generate_image($prompt, $additional_params = []) {
        // Validate parameters before proceeding
        $validation = $this->validate_parameters($prompt, $additional_params);
        if (is_wp_error($validation)) {
            return $validation;
        }

        try {
            // Make the API request
            $response = $this->make_api_request($prompt, $additional_params);
            if (is_wp_error($response)) {
                return $response;
            }

            // Process the API response
            $result = $this->process_api_response($response);
            if (is_wp_error($result)) {
                return $result;
            }

            // Handle different response formats
            if (is_array($result) && isset($result['url']) && isset($result['id']) && $result['id'] > 0) {
                // This is already a fully processed result with proper WP media ID
                return $result;
            } else if (is_array($result) && isset($result['url'])) {
                // This has a URL but no valid ID, so upload to media library
                return KaiGen_Image_Handler::upload_to_media_library($result['url'], $prompt);
            } else if (is_string($result) && filter_var($result, FILTER_VALIDATE_URL)) {
                // This is a URL string, upload to media library
                return KaiGen_Image_Handler::upload_to_media_library($result, $prompt);
            } else if (is_string($result) && strlen($result) > 100) {
                // This is likely raw image data, upload to media library
                return KaiGen_Image_Handler::upload_to_media_library($result, $prompt);
            }
            
            // Fallback for unexpected result format
            return new WP_Error('invalid_result', 'Invalid result format from provider');
        } catch (Exception $e) {
            return new WP_Error('generation_failed', $e->getMessage());
        }
    }

    /**
     * Makes the API request to generate an image.
     * This method must be implemented by each provider.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return mixed The API response.
     */
    abstract public function make_api_request($prompt, $additional_params = []);

    /**
     * Processes the API response to extract the image URL or data.
     * This method must be implemented by each provider.
     *
     * @param mixed $response The API response to process.
     * @return string|WP_Error The image URL/data or error.
     */
    abstract public function process_api_response($response);
}
