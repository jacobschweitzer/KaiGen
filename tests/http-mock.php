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
if (!defined('E2E_TESTING') && !str_contains($_SERVER['HTTP_HOST'] ?? '', 'localhost:9400')) {
    return;
}

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
        
        return [
            'headers'  => ['content-type' => 'application/json'],
            'body'     => wp_json_encode([
                'created' => time(),
                'data' => [
                    [
                        'url' => 'https://via.placeholder.com/1024x1024.png?text=AI+Generated+Image',
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
        
        return [
            'headers'  => ['content-type' => 'application/json'],
            'body'     => wp_json_encode([
                'created' => time(),
                'data' => [
                    [
                        'url' => 'https://via.placeholder.com/1024x1024.png?text=AI+Edited+Image',
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
        
        // Return immediately succeeded response (simulating sync mode)
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
        
        // Return a simple 1x1 transparent PNG
        $png_data = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
        
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

    // Allow all other requests to proceed normally
    return $pre;
}, 10, 3);

// Also add a filter to mock successful uploads
add_filter('wp_handle_sideload_prefilter', function($file) {
    if (defined('E2E_TESTING') || str_contains($_SERVER['HTTP_HOST'] ?? '', 'localhost:9400')) {
        error_log('KaiGen E2E Mock: Intercepting file upload for ' . $file['name']);
    }
    return $file;
});

// Log that the mock is loaded
error_log('KaiGen E2E Mock: HTTP mock loaded and ready');