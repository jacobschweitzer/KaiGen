<?php
/**
 * Interface for image generation providers.
 * This interface defines the contract that all image provider implementations must follow.
 *
 * @package KaiGen
 */

interface KaiGen_Image_Provider_Interface {
    /**
     * Gets the unique identifier for this provider.
     *
     * @return string The unique identifier for this provider.
     */
    public function get_id();

    /**
     * Gets the display name for this provider.
     *
     * @return string The display name for this provider.
     */
    public function get_name();

    /**
     * Makes the API request to generate an image.
     * This method should be implemented by each provider to handle their specific API requirements.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The generated image data or error.
     */
    public function make_api_request($prompt, $additional_params = []);

    /**
     * Processes the API response to extract the image URL or data.
     * This method should be implemented by each provider to handle their specific response format.
     *
     * @param mixed $response The API response to process.
     * @return string|WP_Error The image URL/data or error.
     */
    public function process_api_response($response);

    /**
     * Generates an image based on the provided prompt and additional parameters.
     * This method orchestrates the image generation process using make_api_request and process_api_response.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The generated image data or error.
     */
    public function generate_image($prompt, $additional_params = []);

    /**
     * Validates the format of the provider's API key.
     *
     * @return bool True if the API key is valid, false otherwise.
     */
    public function validate_api_key();

    /**
     * Retrieves the list of available models for this provider.
     *
     * @return array List of available models with model IDs as keys and descriptions as values.
     */
    public function get_available_models();

    /**
     * Gets the currently selected model for this provider.
     *
     * @return string The current model identifier.
     */
    public function get_current_model();

    /**
     * Sets a new model for the provider.
     *
     * @param string $model The new model identifier.
     * @return bool True if the model was successfully set, false otherwise.
     */
    public function set_model($model);
}
