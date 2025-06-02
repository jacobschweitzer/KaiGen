<?php

// Ensure the main plugin file is loaded if it contains class definitions or constants.
// This path might need adjustment based on the actual project structure.
// require_once dirname(dirname(dirname(dirname(__FILE__)))) . '/kaigen.php';

require_once dirname(dirname(dirname(dirname(__FILE__)))) . '/inc/interface-image-provider.php';
require_once dirname(dirname(dirname(dirname(__FILE__)))) . '/inc/class-image-provider.php';
require_once dirname(dirname(dirname(dirname(__FILE__)))) . '/inc/providers/class-image-provider-replicate.php';

use Yoast\WPTestUtils\WPIntegration\TestCase;

// Store arguments for wp_remote_post
class WP_Remote_Post_Spy {
    public static $called_url;
    public static $called_args;
    public static $response = null; // Default response
    public static $expected_calls = 0;
    public static $actual_calls = 0;

    public static function record($url, $args) {
        self::$called_url = $url;
        self::$called_args = $args;
        self::$actual_calls++;
        return self::$response ?: ['body' => wp_json_encode(['status' => 'starting', 'id' => 'test_prediction_id'])]; // Default mock response
    }

    public static function reset() {
        self::$called_url = null;
        self::$called_args = null;
        self::$response = null;
        self::$expected_calls = 0;
        self::$actual_calls = 0;
    }

    public static function set_response($response) {
        self::$response = $response;
    }
}


// Mock WordPress functions not available in standard PHPUnit unless WP testing framework is fully loaded.
if (!function_exists('get_option')) {
    function get_option($option_name, $default = false) {
        // Allow mocking specific options for tests
        if (isset($GLOBALS['mock_options'][$option_name])) {
            return $GLOBALS['mock_options'][$option_name];
        }
        return $default;
    }
}

if (!function_exists('wp_remote_post')) {
    function wp_remote_post($url, $args) {
        return WP_Remote_Post_Spy::record($url, $args);
    }
}

if (!function_exists('wp_json_encode')) {
    function wp_json_encode($data) {
        return json_encode($data);
    }
}

if (!function_exists('is_wp_error')) {
    function is_wp_error($thing) {
        return $thing instanceof WP_Error;
    }
}

if (!class_exists('WP_Error')) {
    class WP_Error {
        public $errors = [];
        public function __construct($code = '', $message = '', $data = '') {
            // Simplified constructor
        }
        public function add($code, $message, $data = '') {
            // Simplified add method
        }
        public function get_error_message() {
            return 'WP_Error_message';
        }
    }
}


class KaiGen_Image_Provider_Replicate_Test extends TestCase {

    protected $provider;
    protected $api_key = 'test-replicate-api-key'; // Dummy API key

    public function set_up_before_class() {
        parent::set_up_before_class();
        // Set up any global state or mocks needed for all tests in this class
        $GLOBALS['mock_options'] = [];
    }

    public function tear_down_after_class() {
        unset($GLOBALS['mock_options']);
        parent::tear_down_after_class();
    }

    protected function set_option($option_name, $value) {
        $GLOBALS['mock_options'][$option_name] = $value;
    }

    public function set_up() {
        parent::set_up();
        // Mock get_option for quality settings for constructor
        $this->set_option('kaigen_quality_settings', ['quality' => 'medium']);
        $this->set_option('kaigen_quality_setting', 'medium'); // Legacy option

        $this->provider = new KaiGen_Image_Provider_Replicate($this->api_key);
    }

    public function tear_down() {
        WP_Remote_Post_Spy::reset();
        // Clean up any changes made to $GLOBALS['mock_options'] specific to a test
        // $GLOBALS['mock_options'] = []; // Reset if needed, or manage per test
        parent::tear_down();
    }

    public function test_get_available_models() {
        $models = $this->provider->get_available_models();
        $this->assertIsArray($models);
        $this->assertArrayHasKey('black-forest-labs/flux-kontext-pro', $models);
        $this->assertEquals('Flux Kontext Pro by Black Forest Labs (image-to-image)', $models['black-forest-labs/flux-kontext-pro']);
        $this->assertArrayHasKey('google/imagen-4', $models);
    }

    public function test_get_model_from_quality_setting() {
        $this->assertEquals('black-forest-labs/flux-schnell', $this->provider->get_model_from_quality_setting('low'));
        $this->assertEquals('recraft-ai/recraft-v3', $this->provider->get_model_from_quality_setting('medium'));
        $this->assertEquals('google/imagen-4', $this->provider->get_model_from_quality_setting('high'));
        $this->assertEquals('black-forest-labs/flux-kontext-pro', $this->provider->get_model_from_quality_setting('image_to_image'));
        // Test default case
        $this->assertEquals('recraft-ai/recraft-v3', $this->provider->get_model_from_quality_setting('unknown_quality'));
    }

    public function test_supports_image_to_image() {
        // Simulate the image-to-image model being active
        $this->set_option('kaigen_quality_settings', ['quality' => 'image_to_image']);
        $this->set_option('kaigen_quality_setting', 'image_to_image'); // legacy
        $provider_img2img = new KaiGen_Image_Provider_Replicate($this->api_key);
        $this->assertTrue($provider_img2img->supports_image_to_image());

        // Simulate a text-to-image model being active
        $this->set_option('kaigen_quality_settings', ['quality' => 'high']);
        $this->set_option('kaigen_quality_setting', 'high'); // legacy
        $provider_txt2img = new KaiGen_Image_Provider_Replicate($this->api_key);
        $this->assertFalse($provider_txt2img->supports_image_to_image());
    }

    public function test_make_api_request_text_to_image() {
        // Set up a text-to-image model
        $this->set_option('kaigen_quality_settings', ['quality' => 'high']); // e.g., google/imagen-4
        $this->set_option('kaigen_quality_setting', 'high');
        $provider = new KaiGen_Image_Provider_Replicate($this->api_key);

        $prompt = "A beautiful sunset";
        WP_Remote_Post_Spy::$expected_calls = 1; // Expect one call

        $provider->make_api_request($prompt);

        $this->assertEquals(1, WP_Remote_Post_Spy::$actual_calls);
        $this->assertStringContainsString('google/imagen-4/predictions', WP_Remote_Post_Spy::$called_url);

        $request_body = json_decode(WP_Remote_Post_Spy::$called_args['body'], true);
        $this->assertArrayHasKey('prompt', $request_body['input']);
        $this->assertEquals($prompt, $request_body['input']['prompt']);
        $this->assertArrayNotHasKey('input_image', $request_body['input']);
    }

    public function test_make_api_request_image_to_image() {
        // Set up the image-to-image model
        $this->set_option('kaigen_quality_settings', ['quality' => 'image_to_image']);
        $this->set_option('kaigen_quality_setting', 'image_to_image');
        $provider = new KaiGen_Image_Provider_Replicate($this->api_key);

        $prompt = "A fantasy castle";
        $input_image_url = 'http://example.com/image.png';
        $aspect_ratio = '16:9';
        $additional_params = ['input_image' => $input_image_url, 'aspect_ratio' => $aspect_ratio];
        WP_Remote_Post_Spy::$expected_calls = 1;

        $provider->make_api_request($prompt, $additional_params);

        $this->assertEquals(1, WP_Remote_Post_Spy::$actual_calls);
        $this->assertStringContainsString('black-forest-labs/flux-kontext-pro/predictions', WP_Remote_Post_Spy::$called_url);

        $request_body = json_decode(WP_Remote_Post_Spy::$called_args['body'], true);
        $this->assertArrayHasKey('prompt', $request_body['input']);
        $this->assertEquals($prompt, $request_body['input']['prompt']);
        $this->assertArrayHasKey('input_image', $request_body['input']);
        $this->assertEquals($input_image_url, $request_body['input']['input_image']);
        $this->assertArrayHasKey('aspect_ratio', $request_body['input']);
        $this->assertEquals($aspect_ratio, $request_body['input']['aspect_ratio']);
    }

    public function test_make_api_request_image_to_image_no_input_image_param() {
        // Set up the image-to-image model
        $this->set_option('kaigen_quality_settings', ['quality' => 'image_to_image']);
        $this->set_option('kaigen_quality_setting', 'image_to_image');
        $provider = new KaiGen_Image_Provider_Replicate($this->api_key);

        $prompt = "A modern cityscape";
        $additional_params = ['aspect_ratio' => '1:1']; // No input_image
        WP_Remote_Post_Spy::$expected_calls = 1;

        $provider->make_api_request($prompt, $additional_params);

        $this->assertEquals(1, WP_Remote_Post_Spy::$actual_calls);
        $this->assertStringContainsString('black-forest-labs/flux-kontext-pro/predictions', WP_Remote_Post_Spy::$called_url);

        $request_body = json_decode(WP_Remote_Post_Spy::$called_args['body'], true);
        $this->assertArrayHasKey('prompt', $request_body['input']);
        $this->assertEquals($prompt, $request_body['input']['prompt']);
        $this->assertArrayNotHasKey('input_image', $request_body['input']);
        $this->assertArrayHasKey('aspect_ratio', $request_body['input']);
        $this->assertEquals('1:1', $request_body['input']['aspect_ratio']);
    }
}
