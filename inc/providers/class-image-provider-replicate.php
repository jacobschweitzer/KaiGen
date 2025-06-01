<?php
/**
 * Replicate API provider implementation for KaiGen.
 *
 * @package KaiGen
 */

/**
 * This class handles image generation using the Replicate API service.
 */
class KaiGen_Image_Provider_Replicate extends KaiGen_Image_Provider {
    /**
     * The base URL for the Replicate API.
     */
    private const API_BASE_URL = 'https://api.replicate.com/v1/models/';

    /**
     * Gets the unique identifier for this provider.
     *
     * @return string The unique identifier for this provider.
     */
    public function get_id() {
        return 'replicate';
    }

    /**
     * Gets the display name for this provider.
     *
     * @return string The display name for this provider.
     */
    public function get_name() {
        return 'Replicate';
    }

    /**
     * Gets the request headers for the API request.
     * Uses sync mode with shorter timeout since data URLs are no longer supported.
     *
     * @return array The request headers.
     */
    protected function get_request_headers() {
        return [
            'Authorization' => 'Token ' . $this->api_key,
            'Content-Type'  => 'application/json',
            'Prefer'       => 'wait=10' // Shorter sync timeout since we only wait for URL
        ];
    }

    /**
     * Overrides the parent method to get the current model from the quality setting.
     * @return string The current model.
     */
    public function get_current_model() {
        // Get all quality-related options to debug
        $quality_settings = get_option('kaigen_quality_settings');
        $quality_setting = get_option('kaigen_quality_setting');

        // Use the correct option name
        $quality = 'medium'; // Default
        if (is_array($quality_settings) && isset($quality_settings['quality'])) {
            $quality = $quality_settings['quality'];
        }
        
        $model = $this->get_model_from_quality_setting($quality);
        return $model;
    }

    /**
     * Makes the API request to generate an image.
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The API response or error.
     */
    public function make_api_request($prompt, $additional_params = []) {
        // Handle polling mode if prediction_id exists
        if (!empty($additional_params['prediction_id'])) {
            return $this->check_prediction_status($additional_params['prediction_id']);
        }

        $headers = $this->get_request_headers();

        $input_data = ['prompt' => $prompt];
        // Check if the current model supports image-to-image and input_image is provided
        if ($this->supports_image_to_image() && !empty($additional_params['input_image'])) {
            $input_data['input_image'] = $additional_params['input_image'];
            // Remove input_image from additional_params to prevent duplication
            unset($additional_params['input_image']);
        }

        $body = [
            'input' => array_merge(
                $input_data,
                $additional_params // Add other params like aspect_ratio etc.
            )
        ];
        
        $api_url = self::API_BASE_URL . "{$this->model}/predictions";

        // Make initial request with shorter timeout since we're just waiting for the URL
        $response = wp_remote_post(
            $api_url,
            [
                'headers' => $headers,
                'body'    => wp_json_encode($body),
                'timeout' => 15,
            ]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        // If we got a completed prediction with output, return it immediately
        if (isset($body['status']) && $body['status'] === 'succeeded' && 
            isset($body['output']) && !empty($body['output'])) {
            return [
                'status' => 'succeeded',
                'output' => $body['output'],
                'id' => $body['id']
            ];
        }

        // Return the response for polling
        return $body;
    }

    /**
     * Checks the status of a prediction.
     * @param string $prediction_id The ID of the prediction to check.
     * @return array|WP_Error The status response or error.
     */
    private function check_prediction_status($prediction_id) {
        $headers = $this->get_request_headers();
        $api_url = "https://api.replicate.com/v1/predictions/{$prediction_id}";

        $response = wp_remote_get(
            $api_url,
            [
                'headers' => $headers,
                'timeout' => 8
            ]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        // Return the full response to let the process_api_response handle it
        return $body;
    }

    /**
     * Processes the API response to extract the image URL or data.
     * @param mixed $response The API response to process.
     * @return string|WP_Error The image URL/data or error.
     */
    public function process_api_response($response) {

        if (!is_array($response)) {
            return new WP_Error('replicate_error', 'Invalid response format from Replicate');
        }

        // Check for error in response
        if (!empty($response['error'])) {
            // Return a user-friendly error for content moderation failures
            if (strpos($response['error'], '400 Image generation failed') !== false) {
                return new WP_Error(
                    'content_moderation',
                    'Your prompt contains content that violates AI safety guidelines. Please try rephrasing it.'
                );
            }
            return new WP_Error('replicate_error', $response['error']);
        }

        // Check the prediction status
        $status = $response['status'] ?? 'unknown';

        // Handle failed status specifically
        if ($status === 'failed') {
            $error_message = 'Image generation failed';
            
            // Check both error field and logs for detailed error messages
            $error_details = $response['error'] ?? '';
            $logs = $response['logs'] ?? '';
            
            // Look for content moderation failures in both error and logs
            if (
                strpos($error_details . $logs, "violate Google's Responsible AI practices") !== false ||
                strpos($error_details . $logs, "sensitive words") !== false ||
                strpos($error_details . $logs, "content moderation") !== false
            ) {
                $error_message = 'Your prompt contains content that violates AI safety guidelines. Please try rephrasing it.';
                return new WP_Error('content_moderation', $error_message);
            }
            
            // Use the specific error message if available
            if (!empty($error_details)) {
                $error_message = $error_details;
            }
            
            return new WP_Error('generation_failed', $error_message);
        }

        // Handle succeeded status with direct output URL
        if ($status === 'succeeded' && !empty($response['output'])) {
            $image_url = is_array($response['output']) ? $response['output'][0] : $response['output'];
            return $image_url;
        }

        // Return pending error with prediction ID for polling
        if (isset($response['id'])) {
            return new WP_Error(
                'replicate_pending',
                'Image generation is still processing',
                ['prediction_id' => $response['id']]
            );
        }

        return new WP_Error('replicate_error', 'No image data in response');
    }

    /**
     * Validates the API key format for Replicate.
     *
     * @return bool True if the API key is valid, false otherwise.
     */
    public function validate_api_key() {
        // Replicate API keys are typically 40 characters long
        return !empty($this->api_key) && strlen($this->api_key) === 40;
    }

    /**
     * Gets the available models for Replicate.
     *
     * @return array List of available models with their display names.
     */
    public function get_available_models() {
        return [
            'black-forest-labs/flux-schnell' => 'Flux Schnell by Black Forest Labs (low quality)',
            'black-forest-labs/flux-1.1-pro' => 'Flux 1.1 Pro by Black Forest Labs (high quality)',
            'recraft-ai/recraft-v3'          => 'Recraft V3 by Recraft AI (high quality)',
            'google/imagen-3'                => 'Imagen 3 by Google (highest quality)',
            'black-forest-labs/flux-kontext-pro' => 'Flux Kontext Pro by Black Forest Labs (image-to-image)',
        ];
    }

    /**
     * Gets the model from the quality setting.
     * @param string $quality_setting The quality setting.
     * @return string The model.
     */
    public function get_model_from_quality_setting($quality_setting) {
        switch ($quality_setting) {
            case 'low':
                $model = 'black-forest-labs/flux-schnell';
                break;
            case 'medium':
                $model = 'recraft-ai/recraft-v3';
                break;
            case 'high':
                $model = 'google/imagen-3'; // Corrected to imagen-3 as per available models
                break;
            case 'image_to_image':
                $model = 'black-forest-labs/flux-kontext-pro';
                break;
            default:
                $model = 'recraft-ai/recraft-v3'; // Default to medium quality, a text-to-image model
        }
        return $model;
    }

    /**
     * Checks if the current model supports image-to-image.
     *
     * @return bool True if the model supports image-to-image, false otherwise.
     */
    public function supports_image_to_image() {
        return $this->model === 'black-forest-labs/flux-kontext-pro';
    }
}
