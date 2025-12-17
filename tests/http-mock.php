<?php
/**
 * HTTP Mock for E2E testing
 * 
 * This mu-plugin intercepts external HTTP requests during E2E tests
 * and returns mocked responses for OpenAI and Replicate APIs.
 *
 * @package KaiGen
 */

// Only run in test environment
$host = $_SERVER['HTTP_HOST'] ?? '';
if (!defined('E2E_TESTING') && !str_contains($host, '127.0.0.1:9400') && !str_contains($host, 'localhost:9400')) {
    return;
}

// Log that we're in test mode
error_log('KaiGen E2E Mock: Test environment detected - E2E_TESTING: ' . (defined('E2E_TESTING') ? 'true' : 'false') . ', Host: ' . ($_SERVER['HTTP_HOST'] ?? 'unknown'));

/**
 * Filter to intercept HTTP requests and return mocked responses.
 */
add_filter('pre_http_request', function ($pre, $args, $url) {
    // Log the request for debugging
    error_log('KaiGen E2E Mock: Intercepting request to ' . $url);

    // Extract the prompt from the request body if available
    $prompt = '';
    if (!empty($args['body'])) {
        if (is_string($args['body'])) {
            $body_data = json_decode($args['body'], true);
            if (isset($body_data['prompt'])) {
                $prompt = $body_data['prompt'];
            } elseif (isset($body_data['input']['prompt'])) {
                $prompt = $body_data['input']['prompt'];
            }
        }
    }

    // Check if this is an error test case
    if (str_contains($prompt, 'TRIGGER_ERROR_RESPONSE')) {
        error_log('KaiGen E2E Mock: Returning error response for test prompt');
        
        if (str_contains($url, 'api.openai.com')) {
            return [
                'headers'  => ['content-type' => 'application/json'],
                'body'     => wp_json_encode([
                    'error' => [
                        'message' => 'Your request was rejected as a result of our safety system.',
                        'type' => 'invalid_request_error',
                        'code' => 'content_policy_violation'
                    ]
                ]),
                'response' => [
                    'code' => 400,
                    'message' => 'Bad Request'
                ],
                'cookies' => [],
                'filename' => ''
            ];
        } elseif (str_contains($url, 'api.replicate.com')) {
            return [
                'headers'  => ['content-type' => 'application/json'],
                'body'     => wp_json_encode([
                    'id' => 'test-error-' . uniqid(),
                    'status' => 'failed',
                    'error' => 'Your prompt contains content that violates AI safety guidelines. Please try rephrasing it.',
                    'logs' => 'Content moderation: prompt contains sensitive words',
                    'created_at' => date('c'),
                    'completed_at' => date('c')
                ]),
                'response' => [
                    'code' => 200,
                    'message' => 'OK'
                ],
                'cookies' => [],
                'filename' => ''
            ];
        }
    }

    // Mock OpenAI image generation endpoint
    if (str_contains($url, 'api.openai.com/v1/images/generations')) {
        error_log('KaiGen E2E Mock: Returning mocked OpenAI generation response');
        
        // 24x24 green checkmark.
        $png_base64 = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAPJJREFUSEvt1M0RgjAQBOCWq3QD3SA36QbphGyQbpBuoG4g3SAdwAbtJg7sCg7QhZAEb3L5l5CQUlq4W3h5IcwQ2gU3nd23sQggoZoJAxzEa243u0G2QAvzKLRNC9gQwpIBbeoV0A+w/wN8AcflGqY7QPl4gA3kNaYg9k/wbQCNY3E0sA0LDUQx3wFj2Gr+C8wd4AxbMMSx3wBs5piO2b4C3MwzzHds3gFv5hjO274CPs0xzHcv3gFv5hrW2z4C3s0wrLf8BrOYZ1lv+wns5plWW/4DOs9zLP8B7OYZ1mGfAQTwC3b3/wFSGddpE8wD/gAAAABJRU5ErkJggg==';
        $base64_image = $png_base64;
        
        return [
            'headers'  => ['content-type' => 'application/json'],
            'body'     => wp_json_encode([
                'created' => time(),
                'data' => [
                    [
                        // Provide base64 image data via b64_json key per OpenAI spec
                        'b64_json' => $base64_image,
                        'revised_prompt' => 'A beautiful sunset over mountains with vibrant colors'
                    ]
                ]
            ]),
            'response' => [
                'code' => 200,
                'message' => 'OK'
            ],
            'cookies' => [],
            'filename' => ''
        ];
    }

    // Mock OpenAI image edit endpoint (for image-to-image)
    if (str_contains($url, 'api.openai.com/v1/images/edits')) {
        error_log('KaiGen E2E Mock: Returning mocked OpenAI edit response');
        
        $placeholder_base64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAfUlEQVR42u3RAQ0AAAjDMO5fNCxICg0B0FEBGUgDJSMpIyljKSMrYykhKSMpYyklKWOpIyllKSMpYykhKSMpYyklKSMpYyklKWOpIyllKSMpYykhKSMpYyklKSMpYyklKSMpYyklKSMpYyklKSMpYyklKSMpYyklKSMpYyklKSMpYyklKWOpIyllKWw/4Ab2agQMAAAAAElFTkSuQmCC';
        
        return [
            'headers'  => ['content-type' => 'application/json'],
            'body'     => wp_json_encode([
                'created' => time(),
                'data' => [
                    [
                        'b64_json' => $placeholder_base64,
                        'revised_prompt' => 'An edited version of the original image'
                    ]
                ]
            ]),
            'response' => [
                'code' => 200,
                'message' => 'OK'
            ],
            'cookies' => [],
            'filename' => ''
        ];
    }

    // Mock Replicate predictions endpoint
    if (str_contains($url, 'api.replicate.com/v1/models/') && str_contains($url, '/predictions')) {
        error_log('KaiGen E2E Mock: Returning mocked Replicate prediction creation response');
        
        $prediction_id = 'test-' . uniqid();
        
        return [
            'headers'  => ['content-type' => 'application/json'],
            'body'     => wp_json_encode([
                'id' => $prediction_id,
                'status' => 'succeeded',
                'output' => ['https://via.placeholder.com/1024x1024.png?text=Replicate+Generated+Image'],
                'created_at' => date('c'),
                'completed_at' => date('c'),
                'metrics' => [
                    'predict_time' => 2.5
                ]
            ]),
            'response' => [
                'code' => 200,
                'message' => 'OK'
            ],
            'cookies' => [],
            'filename' => ''
        ];
    }

    // Mock Replicate prediction status check endpoint
    if (str_contains($url, 'api.replicate.com/v1/predictions/')) {
        error_log('KaiGen E2E Mock: Returning mocked Replicate prediction status response');
        
        $prediction_id = basename($url);
        
        return [
            'headers'  => ['content-type' => 'application/json'],
            'body'     => wp_json_encode([
                'id' => $prediction_id,
                'status' => 'succeeded',
                'output' => ['https://via.placeholder.com/1024x1024.png?text=Replicate+Generated+Image'],
                'created_at' => date('c'),
                'completed_at' => date('c'),
                'metrics' => [
                    'predict_time' => 2.5
                ]
            ]),
            'response' => [
                'code' => 200,
                'message' => 'OK'
            ],
            'cookies' => [],
            'filename' => ''
        ];
    }

    // Mock placeholder.com image requests (to prevent actual external requests)
    if (str_contains($url, 'via.placeholder.com')) {
        error_log('KaiGen E2E Mock: Returning mocked placeholder image');
        
        $png_placeholder_base64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAfUlEQVR42u3RAQ0AAAjDMO5fNCxICg0B0FEBGUgDJSMpIyljKSMrYykhKSMpYyklKWOpIyllKSMpYykhKSMpYyklKSMpYyklKWOpIyllKSMpYykhKSMpYyklKSMpYyklKWOpIyllKSMpYykhKSMpYyklKSMpYyklKWOpIyllKWw/4Ab2agQMAAAAAElFTkSuQmCC';
        $png_data = base64_decode($png_placeholder_base64);
        
        return [
            'headers'  => [
                'content-type' => 'image/png',
                'content-length' => strlen($png_data)
            ],
            'body'     => $png_data,
            'response' => [
                'code' => 200,
                'message' => 'OK'
            ],
            'cookies' => [],
            'filename' => ''
        ];
    }

    // Mock OpenAI models list endpoint (for API key validation)
    if (str_contains($url, 'api.openai.com/v1/models') && !str_contains($url, '/gpt-image-1.5')) {
        error_log('KaiGen E2E Mock: Returning mocked OpenAI models list response');
        
        return [
            'headers'  => ['content-type' => 'application/json'],
            'body'     => wp_json_encode([
                'object' => 'list',
                'data' => [
                    [
                        'id' => 'gpt-image-1.5',
                        'object' => 'model',
                        'created' => time(),
                        'owned_by' => 'openai'
                    ]
                ]
            ]),
            'response' => [
                'code' => 200,
                'message' => 'OK'
            ],
            'cookies' => [],
            'filename' => ''
        ];
    }

    // Mock OpenAI single model endpoint (for image model access check)
    if (str_contains($url, 'api.openai.com/v1/models/gpt-image-1.5')) {
        error_log('KaiGen E2E Mock: Returning mocked OpenAI single model response');
        
        return [
            'headers'  => ['content-type' => 'application/json'],
            'body'     => wp_json_encode([
                'id' => 'gpt-image-1.5',
                'object' => 'model',
                'created' => time(),
                'owned_by' => 'openai'
            ]),
            'response' => [
                'code' => 200,
                'message' => 'OK'
            ],
            'cookies' => [],
            'filename' => ''
        ];
    }

    // Allow all other requests to proceed normally
    return $pre;
}, 10, 3);

// Intercept direct requests for "uploaded" mock images and serve the file data.
// This is needed because the browser will request the URL returned by the media library.
add_action('template_redirect', function() {
    $url = $_SERVER['REQUEST_URI'];
    
    if (str_contains($url, '/wp-content/uploads/') && (str_ends_with($url, '.webp') || str_ends_with($url, '.png'))) {
        error_log('KaiGen E2E Mock (template_redirect): Serving mocked image for uploaded file request: ' . $url);

        // Serve a consistent green checkmark for any generated image request
        $png_base64 = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAPJJREFUSEvt1M0RgjAQBOCWq3QD3SA36QbphGyQbpBuoG4g3SAdwAbtJg7sCg7QhZAEb3L5l5CQUlq4W3h5IcwQ2gU3nd23sQggoZoJAxzEa243u0G2QAvzKLRNC9gQwpIBbeoV0A+w/wN8AcflGqY7QPl4gA3kNaYg9k/wbQCNY3E0sA0LDUQx3wFj2Gr+C8wd4AxbMMSx3wBs5piO2b4C3MwzzHds3gFv5hjO274CPs0xzHcv3gFv5hrW2z4C3s0wrLf8BrOYZ1lv+wns5plWW/4DOs9zLP8B7OYZ1mGfAQTwC3b3/wFSGddpE8wD/gAAAABJRU5ErkJggg==';
        $png_data = base64_decode($png_base64);

        header('Content-Type: image/png');
        header('Content-Length: ' . strlen($png_data));
        echo $png_data;
        die();
    }
});

// Also add a filter to mock successful uploads
add_filter('wp_handle_sideload_prefilter', function($file) {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (defined('E2E_TESTING') || str_contains($host, '127.0.0.1:9400') || str_contains($host, 'localhost:9400')) {
        error_log('KaiGen E2E Mock: Intercepting file upload for ' . $file['name']);
    }
    return $file;
});

// Log that the mock is loaded
error_log('KaiGen E2E Mock: HTTP mock loaded and ready');