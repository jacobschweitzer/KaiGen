<?php
/**
 * OpenAI API provider implementation for WP AI Image Gen.
 *
 * @package WP_AI_Image_Gen
 */

class WP_AI_Image_Provider_OpenAI extends WP_AI_Image_Provider {
    /**
     * The base URL for the OpenAI API.
     */
    private const API_BASE_URL = 'https://api.openai.com/v1/images/generations';

    /**
     * Image edit API endpoint.
     */
    private const IMAGE_EDIT_API_BASE_URL = 'https://api.openai.com/v1/images/edits';

    /**
     * Gets the unique identifier for this provider.
     *
     * @return string The unique identifier for this provider.
     */
    public function get_id() {
        return 'openai';
    }

    /**
     * Gets the display name for this provider.
     *
     * @return string The display name for this provider.
     */
    public function get_name() {
        return 'OpenAI';
    }

    /**
     * Makes the API request to generate an image.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The API response or error.
     */
    public function make_api_request($prompt, $additional_params = []) {
        $source_image_url = $additional_params['source_image_url'] ?? null;
        $max_retries = 3; // Reduce max retries to fail faster
        $timeout = 60; // Set request timeout to 60 seconds
        $retry_delay = 2; // Seconds to wait between retries

        // Add filter to ensure WordPress respects our timeout settings
        add_filter('http_request_timeout', function() use ($timeout) {
            return $timeout;
        });

        // Add filter to set cURL options
        add_filter('http_request_args', function($args) use ($timeout) {
            $args['timeout'] = $timeout;
            $args['httpversion'] = '1.1';
            $args['sslverify'] = true;
            $args['blocking'] = true;
            
            // Set cURL options directly
            if (!isset($args['curl'])) {
                $args['curl'] = [];
            }
            $args['curl'][CURLOPT_TIMEOUT] = $timeout;
            $args['curl'][CURLOPT_CONNECTTIMEOUT] = 10;
            $args['curl'][CURLOPT_LOW_SPEED_TIME] = 30; // Increased low speed time
            $args['curl'][CURLOPT_LOW_SPEED_LIMIT] = 1024; // 1KB/s minimum speed
            
            return $args;
        });

        // Default to API_BASE_URL.
        $endpoint = self::API_BASE_URL;

        // Log if we're using image-to-image
        if ( ! empty( $source_image_url ) ) {
            $endpoint = self::IMAGE_EDIT_API_BASE_URL;
            wp_ai_image_gen_debug_log("Using image-to-image with GPT Image-1: {$source_image_url}");
        }
        
        // Get quality setting from admin options
        $quality_settings = get_option('wp_ai_image_gen_quality_settings', []);
        $quality = isset($quality_settings['quality']) ? $quality_settings['quality'] : 'medium';
        
        // Map quality settings to supported values
        $quality_map = [
            'low' => 'low',
            'medium' => 'medium',
            'high' => 'high',
            'hd' => 'high', // Map 'hd' to 'high'
            'auto' => 'auto'
        ];
        
        // Ensure we're using a supported quality value
        $quality = isset($quality_map[$quality]) ? $quality_map[$quality] : 'medium';
        
        // Prepare the request based on the type of request
        if ( ! empty( $source_image_url ) ) {
            // For image edit requests, we need to use multipart/form-data
            $boundary = wp_generate_password(24, false);
            $headers = array_merge(
                $this->get_request_headers(),
                ['Content-Type' => 'multipart/form-data; boundary=' . $boundary]
            );
            
            // Start building the multipart body
            $body = '';
            
            // Add model parameter
            $body .= "--{$boundary}\r\n";
            $body .= 'Content-Disposition: form-data; name="model"' . "\r\n\r\n";
            $body .= "gpt-image-1\r\n";
            
            // Add prompt parameter
            $body .= "--{$boundary}\r\n";
            $body .= 'Content-Disposition: form-data; name="prompt"' . "\r\n\r\n";
            $body .= $prompt . "\r\n";
            
            // Add image files
            if (is_array($source_image_url)) {
                foreach ($source_image_url as $index => $image_url) {
                    $image_data = $this->get_image_data($image_url);
                    if (is_wp_error($image_data)) {
                        return $image_data;
                    }
                    
                    $body .= "--{$boundary}\r\n";
                    $body .= 'Content-Disposition: form-data; name="image[]"; filename="' . basename($image_url) . '"' . "\r\n";
                    $body .= 'Content-Type: ' . $this->get_image_mime_type($image_url) . "\r\n\r\n";
                    $body .= $image_data . "\r\n";
                }
            } else {
                $image_data = $this->get_image_data($source_image_url);
                if (is_wp_error($image_data)) {
                    return $image_data;
                }
                
                $body .= "--{$boundary}\r\n";
                $body .= 'Content-Disposition: form-data; name="image"; filename="' . basename($source_image_url) . '"' . "\r\n";
                $body .= 'Content-Type: ' . $this->get_image_mime_type($source_image_url) . "\r\n\r\n";
                $body .= $image_data . "\r\n";
            }
            
            // Close the multipart body
            $body .= "--{$boundary}--\r\n";
            
        } else {
            // For regular image generation requests, use JSON
            $headers = $this->get_request_headers();
            $body = [
                'model'   => 'gpt-image-1',
                'prompt'  => $prompt,
                'quality' => $quality,
            ];
            
            // Add size parameter if aspect ratio is specified
            if (isset($additional_params['aspect_ratio'])) {
                list($width, $height) = $this->map_aspect_ratio_to_dimensions($additional_params['aspect_ratio'] ?? '1:1');
                $body['size'] = "{$width}x{$height}";
            }
            
            $body = wp_json_encode($body);
        }
        
        wp_ai_image_gen_debug_log("OpenAI API request to: " . $endpoint);
        
        // Make the API request with retries
        $attempt = 0;
        $last_error = null;
        
        while ($attempt < $max_retries) {
            $attempt++;
            wp_ai_image_gen_debug_log("Attempt {$attempt} of {$max_retries}");
            
            $response = wp_remote_post(
                $endpoint,
                [
                    'headers' => $headers,
                    'body'    => $body,
                    'timeout' => $timeout,
                ]
            );
            
            if (is_wp_error($response)) {
                $last_error = $response;
                $error_message = $response->get_error_message();
                
                // Check if it's a timeout error
                if (strpos($error_message, 'timeout') !== false) {
                    wp_ai_image_gen_debug_log("Timeout error on attempt {$attempt}: {$error_message}");
                    if ($attempt < $max_retries) {
                        wp_ai_image_gen_debug_log("Waiting {$retry_delay} seconds before retry...");
                        sleep($retry_delay);
                        continue;
                    }
                }
                
                // For other errors, return immediately
                wp_ai_image_gen_debug_log("Error on attempt {$attempt}: {$error_message}");
                return $response;
            }
            
            $response_body = wp_remote_retrieve_body($response);
            $response_code = wp_remote_retrieve_response_code($response);
            
            // Log the response
            wp_ai_image_gen_debug_log("Response code: " . $response_code);
            wp_ai_image_gen_debug_log("Response body: " . $response_body);
            
            // Handle error responses
            if ($response_code >= 400) {
                wp_ai_image_gen_debug_log("Error response from OpenAI API: " . $response_body);
                $error_data = json_decode($response_body, true);
                
                if (is_array($error_data) && isset($error_data['error'])) {
                    $error_message = $error_data['error']['message'] ?? 'Unknown error';
                    
                    // If there's an error with the image URL in the prompt, try again with just the text prompt
                    if (!empty($source_image_url) && 
                       (strpos($error_message, 'URL') !== false || 
                        strpos($error_message, 'prompt') !== false)) {
                        
                        wp_ai_image_gen_debug_log("Error with image URL in prompt, retrying with text only");
                        
                        // Remove the image URL from the body and retry
                        $body['prompt'] = $prompt;
                        $retry_response = wp_remote_post(
                            $endpoint,
                            [
                                'headers' => $this->get_request_headers(),
                                'body'    => wp_json_encode($body),
                                'timeout' => $timeout,
                            ]
                        );
                        
                        if (!is_wp_error($retry_response)) {
                            $retry_body = wp_remote_retrieve_body($retry_response);
                            $retry_code = wp_remote_retrieve_response_code($retry_response);
                            
                            if ($retry_code < 400) {
                                return json_decode($retry_body, true);
                            }
                        }
                    }
                    
                    return new WP_Error('openai_error', $error_message);
                }
                
                return new WP_Error('api_error', "API Error (HTTP $response_code): $response_body");
            }
            
            // Success! Return the response
            return json_decode($response_body, true);
        }
        
        // If we get here, all retries failed
        if ($last_error) {
            return $last_error;
        }
        
        return new WP_Error('max_retries_exceeded', 'Maximum retry attempts exceeded');
    }
    
    /**
     * Processes the API response to extract the image URL.
     *
     * @param mixed $response The API response to process.
     * @return string|WP_Error The image URL or error.
     */
    public function process_api_response($response) {
        // Log the raw response for debugging
        wp_ai_image_gen_debug_log("Raw OpenAI response: " . wp_json_encode($response));

        // Check for error in response
        if (!empty($response['error'])) {
            wp_ai_image_gen_debug_log("OpenAI API error: " . wp_json_encode($response['error']));
            return new WP_Error('openai_error', $response['error']['message'] ?? 'Unknown error occurred');
        }

        // Check for valid response format
        if (empty($response['data']) || !is_array($response['data'])) {
            wp_ai_image_gen_debug_log("Invalid OpenAI response format: " . wp_json_encode($response));
            return new WP_Error('openai_error', 'Invalid response format from OpenAI');
        }

        // Check for either URL or b64_json in the first data item
        if (empty($response['data'][0]['url']) && empty($response['data'][0]['b64_json'])) {
            wp_ai_image_gen_debug_log("Missing URL or b64_json in OpenAI response: " . wp_json_encode($response['data'][0]));
            return new WP_Error('openai_error', 'Missing image data in OpenAI response');
        }

        // Get the image URL (prefer URL over b64_json)
        $image_url = '';
        if (!empty($response['data'][0]['url'])) {
            $image_url = $response['data'][0]['url'];
            
            // Validate URL format
            if (!filter_var($image_url, FILTER_VALIDATE_URL)) {
                wp_ai_image_gen_debug_log("Invalid URL in OpenAI response: " . $image_url);
                return new WP_Error('openai_error', 'Invalid image URL in response');
            }
        } else if (!empty($response['data'][0]['b64_json'])) {
            // Handle base64 encoded images
            $b64_json = $response['data'][0]['b64_json'];
            $image_data = base64_decode($b64_json);
            
            if (!$image_data) {
                wp_ai_image_gen_debug_log("Invalid base64 data in OpenAI response");
                return new WP_Error('openai_error', 'Invalid base64 image data in response');
            }
            
            // Return the raw image data - the parent class will handle uploading to media library
            wp_ai_image_gen_debug_log("Successfully extracted base64 image data from OpenAI response");
            return $image_data;
        }

        // Just return the URL - the parent class will handle uploading to media library
        wp_ai_image_gen_debug_log("Successfully extracted image URL from OpenAI response: " . $image_url);
        return $image_url;
    }

    /**
     * Validates the API key format according to OpenAI's current standards.
     *
     * @return bool True if the API key matches any of the valid formats, false otherwise.
     */
    public function validate_api_key() {
        // Check if API key exists
        if (empty($this->api_key)) {
            return false;
        }

        // Check if the key starts with any of the valid prefixes
        $valid_prefixes = ['sk-proj-', 'sk-None-', 'sk-svcacct-', 'sk-'];
        
        foreach ($valid_prefixes as $prefix) {
            if (strpos($this->api_key, $prefix) === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Gets the available models for OpenAI.
     *
     * @return array List of available models.
     */
    public function get_available_models() {
        return [
            'gpt-image-1' => 'GPT Image-1 (latest model)',
        ];
    }
    
    /**
     * Checks if this provider supports image-to-image generation with the current model.
     *
     * @return bool True if image-to-image is supported, false otherwise.
     */
    public function supports_image_to_image() {
        // GPT Image-1 supports image-to-image generation by including references in the prompt
        return true;
    }

    /**
     * Maps aspect ratio to OpenAI's supported size formats.
     *
     * @param string $aspect_ratio The desired aspect ratio.
     * @return string The corresponding OpenAI size parameter.
     */
    private function map_aspect_ratio_to_size($aspect_ratio) {
        $sizes = [
            '1:1'  => '1024x1024',
            '16:9' => '1792x1024',
            '9:16' => '1024x1792',
            '4:3'  => '1344x1024',
            '3:4'  => '1024x1344',
        ];

        return $sizes[$aspect_ratio] ?? '1024x1024';
    }
    
    /**
     * Maps aspect ratio to width and height dimensions for GPT Image-1.
     *
     * @param string $aspect_ratio The desired aspect ratio.
     * @return array Array containing width and height as integers.
     */
    private function map_aspect_ratio_to_dimensions($aspect_ratio) {
        $dimensions = [
            '1:1'  => [1024, 1024],
            '16:9' => [1792, 1024],
            '9:16' => [1024, 1792],
            '4:3'  => [1344, 1024],
            '3:4'  => [1024, 1344],
        ];

        return $dimensions[$aspect_ratio] ?? [1024, 1024];
    }

    /**
     * Validates an image for editing.
     *
     * @param string $image_url The URL of the image to validate.
     * @return bool|WP_Error True if valid, WP_Error if invalid.
     */
    public function validate_image_for_edit($image_url) {
        // Check if the image URL is valid
        if (!filter_var($image_url, FILTER_VALIDATE_URL)) {
            return new WP_Error('invalid_url', 'Invalid image URL provided');
        }

        // Get the image file extension
        $extension = strtolower(pathinfo($image_url, PATHINFO_EXTENSION));
        
        // Check if the file type is supported
        $supported_types = ['png', 'webp', 'jpg', 'jpeg'];
        if (!in_array($extension, $supported_types)) {
            return new WP_Error('unsupported_type', 'Image must be PNG, WebP, or JPG format');
        }

        // Check file size (25MB limit for GPT Image-1)
        $response = wp_remote_head($image_url);
        if (is_wp_error($response)) {
            return $response;
        }

        $content_length = wp_remote_retrieve_header($response, 'content-length');
        if ($content_length && $content_length > 25 * 1024 * 1024) {
            return new WP_Error('file_too_large', 'Image must be less than 25MB');
        }

        return true;
    }

    /**
     * Gets the image data from a URL.
     *
     * @param string $image_url The URL of the image.
     * @return string|WP_Error The image data or error.
     */
    private function get_image_data($image_url) {
        $response = wp_remote_get($image_url);
        
        if (is_wp_error($response)) {
            return $response;
        }
        
        $image_data = wp_remote_retrieve_body($response);
        if (empty($image_data)) {
            return new WP_Error('empty_image', 'Could not retrieve image data');
        }
        
        return $image_data;
    }
    
    /**
     * Gets the MIME type of an image from its URL.
     *
     * @param string $image_url The URL of the image.
     * @return string The MIME type.
     */
    private function get_image_mime_type($image_url) {
        $extension = strtolower(pathinfo($image_url, PATHINFO_EXTENSION));
        
        $mime_types = [
            'png'  => 'image/png',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
        ];
        
        return $mime_types[$extension] ?? 'application/octet-stream';
    }
}