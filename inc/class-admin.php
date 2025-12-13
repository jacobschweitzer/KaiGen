<?php
// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Contains the admin page settings.
 *
 * @package KaiGen
 */

/**
 * Handles all WordPress admin functionality for the AI Image Generator plugin.
 */
class KaiGen_Admin {
	/**
	 * Holds the singleton instance of this class.
	 * @var KaiGen_Admin
	 */
	private static $instance = null;

	/**
	 * Holds the list of providers.
	 * @var array
	 */
	private $providers = [];

	/**
	 * Active providers list (active providers have an API key set).
	 * @var array
	 */
	private $active_providers = [];

	/**
	 * Initialize the admin functionality.
	 */
	private function __construct() {
		$this->providers = kaigen_get_providers();
		$this->active_providers = $this->get_active_providers();
		$this->init_hooks();
	}

	/**
	 * Gets the singleton instance of the admin class.
	 * @return KaiGen_Admin The singleton instance.
	 */
	public static function get_instance() {
		if (null === self::$instance) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Initialize WordPress hooks.
	 */
	private function init_hooks() {
		add_action('admin_menu', [$this, 'add_settings_page']);
		add_action('admin_init', [$this, 'register_settings']);
		add_action('admin_enqueue_scripts', [$this, 'enqueue_scripts']);
		add_action('admin_head', [$this, 'preload_logo']);
		add_action('init', [$this, 'register_reference_image_meta']);
		// Enqueue styles inside block editor iframe (WP 5.8+)
		add_action('enqueue_block_assets', [$this, 'enqueue_block_editor_styles']);
			
		// Add settings link to plugin page
		add_filter('plugin_action_links_' . plugin_basename(KAIGEN_PLUGIN_FILE), [$this, 'add_plugin_action_links']);

		// Add the provider setting to the editor settings
		add_filter('block_editor_settings_all', function($settings) {
			$provider = get_option('kaigen_provider', '');
			$api_keys = get_option('kaigen_provider_api_keys', []);

			// If no provider is set but we have active providers, use OpenAI if available, otherwise use the first active provider
			if (empty($provider)) {
				$active_providers = $this->get_active_providers(); // Get fresh list
				if (!empty($active_providers)) {
					
					if (isset($api_keys['openai']) && !empty($api_keys['openai'])) {
						$provider = 'openai';
					} else {
						$provider = $active_providers[0];
					}
				}
			}
			
			// Ensure settings is an array
			if (!is_array($settings)) {
				$settings = [];
			}
			
			// Add the provider setting in all possible locations to ensure it's available
			$settings['kaigen_provider'] = $provider;
			
			if (!isset($settings['kaigen'])) {
				$settings['kaigen'] = [];
			}
			$settings['kaigen']['provider'] = $provider;
			
			// Add to editor settings directly
			if (!isset($settings['kaigen_settings'])) {
				$settings['kaigen_settings'] = [];
			}
			$settings['kaigen_settings']['provider'] = $provider;
			$settings['kaigen_has_api_key'] = !empty($provider) && !empty($api_keys[$provider]);

			return $settings;
		}, 20); // Add a higher priority to ensure our settings are added after others
	}

	/**
	 * Adds the settings page to the WordPress admin.
	 */
	public function add_settings_page() {
		add_options_page(
			'KaiGen Settings', // Page title
			'KaiGen',          // Menu title
			'manage_options',           // Capability
			'kaigen-settings', // Menu slug
			[$this, 'render_settings_page'] // Callback
		);
	}

	/**
	 * Renders the settings page.
	 */
	public function render_settings_page() {
		?>
		<div class="wrap">
			<h1>KaiGen Settings</h1>
			<form method="post" action="options.php">
				<?php
				settings_fields('kaigen_settings');
				do_settings_sections('kaigen-settings');
				submit_button();
				?>
			</form>
		</div>
		<?php
	}

	/**
	 * Registers all settings for the plugin.
	 */
	public function register_settings() {
		$this->migrate_api_keys();

		// Register settings
		register_setting(
			'kaigen_settings',
			'kaigen_provider_api_keys',
			['sanitize_callback' => [$this, 'sanitize_provider_api_keys']]
		);

		// Register quality settings
		register_setting(
			'kaigen_settings',
			'kaigen_quality_settings',
			['sanitize_callback' => [$this, 'sanitize_quality_settings']]
		);

		// Register provider setting
		register_setting(
			'kaigen_settings',
			'kaigen_provider',
			['sanitize_callback' => [$this, 'sanitize_provider']]
		);

		// Add settings section for providers
		add_settings_section(
			'kaigen_settings_section',
			'AI Image Providers',
			[$this, 'render_providers_section'],
			'kaigen-settings'
		);

		// Add quality settings section
		add_settings_section(
			'kaigen_quality_section',
			'Image Quality Settings',
			[$this, 'render_quality_section'],
			'kaigen-settings'
		);

		// Add provider selection field
		add_settings_field(
			'kaigen_provider',
			'Provider',
			[$this, 'render_provider_field'],
			'kaigen-settings',
			'kaigen_settings_section',
			[
				'providers' => array_keys($this->providers), // Show all providers, not just active ones
			]
		);

		// Add settings fields for each provider
		foreach ($this->providers as $provider_id => $provider_name) {
			$this->add_provider_fields($provider_id, $provider_name);
		}

		// Add quality field
		add_settings_field(
			'kaigen_quality_settings',
			'Image Quality',
			[$this, 'render_quality_field'],
			'kaigen-settings',
			'kaigen_quality_section'
		);
	}

	/**
	 * Adds settings fields for a specific provider.
	 */
	private function add_provider_fields($provider_id, $provider_name) {
		// API Key Field
		add_settings_field(
			"kaigen_{$provider_id}_api_key",
			"{$provider_name} API Key",
			[$this, 'render_api_key_field'],
			'kaigen-settings',
			'kaigen_settings_section',
			[
				'provider_id' => $provider_id,
				'provider_name' => $provider_name,
			]
		);
	}

	/**
	 * Migrates old API key options to the new structure.
	 * This function should be called before registering settings.
	 */
	private function migrate_api_keys() {
		$provider_api_keys = get_option('kaigen_provider_api_keys', []);
		$migration_needed = false;

		// Check if OpenAI key exists in old format
		$openai_key = get_option('kaigen_openai_api_key');
		if ($openai_key && !isset($provider_api_keys['openai'])) {
			$provider_api_keys['openai'] = $openai_key;
			$migration_needed = true;
		}

		// Update the option if migration was needed
		if ($migration_needed) {
			update_option('kaigen_provider_api_keys', $provider_api_keys);
			delete_option('kaigen_openai_api_key');
		}
	}

	/**
	 * Sanitizes the provider API keys before saving.
	 * 
	 * @param array $input The input array of provider API keys.
	 * @return array The sanitized array of provider API keys.
	 */
	public function sanitize_provider_api_keys($input) {
		$sanitized_input = [];
		$current_api_keys = get_option('kaigen_provider_api_keys', []);

		foreach ($input as $provider_id => $api_key) {
			$sanitized_key = sanitize_text_field($api_key);

			if ($provider_id === 'openai' && !empty($sanitized_key)) {
				$current_key = isset($current_api_keys['openai']) ? $current_api_keys['openai'] : '';
				
				// Only validate if the key has changed
				if ($sanitized_key !== $current_key) {
					// Check if key is valid
					$headers = ['Authorization' => 'Bearer ' . $sanitized_key];
					$response = wp_remote_get('https://api.openai.com/v1/models', ['headers' => $headers]);
					
					if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
						add_settings_error('kaigen_provider_api_keys', 'kaigen_openai_invalid', 'The provided OpenAI API key is invalid.', 'error');
						continue; // Skip saving this key
					}
					
					// Check if has access to image model
					$model_response = wp_remote_get('https://api.openai.com/v1/models/gpt-image-1', ['headers' => $headers]);
					
					if (is_wp_error($model_response) || wp_remote_retrieve_response_code($model_response) !== 200) {
						$error_message = 'The provided OpenAI API key does not have access to image generation. This may require organization verification. Check in your OpenAI dashboard: <a target="_blank" href="https://platform.openai.com/settings/organization/general">Settings → Organization → General</a>. For more details: <a target="_blank" href="https://help.openai.com/en/articles/10910291-api-organization-verification">OpenAI Help Center</a>.';
						
						// Allow links in the message
						$allowed_html = [
							'a' => [
								'href' => true,
								'target' => true,
								'rel' => true,
							],
						];
						$sanitized_message = wp_kses($error_message, $allowed_html);
						
						add_settings_error(
							'kaigen_provider_api_keys',
							'kaigen_openai_no_access',
							$sanitized_message,
							'error'
						);
						continue; // Skip saving this key
					}
				}
			}

			$sanitized_input[$provider_id] = $sanitized_key;
		}
		
		// Update active providers cache
		$this->active_providers = array_keys(array_filter($sanitized_input));
		
		return $sanitized_input;
	}

	/**
	 * Sanitizes the quality settings.
	 * 
	 * @param array $input The input array of quality settings.
	 * @return array The sanitized array of quality settings.
	 */
	public function sanitize_quality_settings($input) {
		$sanitized_input = [];
		
		// Sanitize quality
		if (isset($input['quality']) && in_array($input['quality'], ['low', 'medium', 'high'])) {
			$sanitized_input['quality'] = $input['quality'];
		} else {
			$sanitized_input['quality'] = 'medium';
		}
		
		return $sanitized_input;
	}

	/**
	 * Renders the providers section description.
	 */
	public function render_providers_section() {
		if (empty($this->providers)) {
			echo '<p class="notice notice-warning">No AI image providers are currently available. Please check the plugin installation.</p>';
		} else {
			echo '<p>First, select your preferred AI image provider from the dropdown below, then enter your API key for that provider.</p>';
		}
	}

	/**
	 * Renders the quality settings section.
	 */
	public function render_quality_section() {
		echo '<p>Configure the quality settings for generated images.</p>';
	}

	/**
	 * Renders the quality field.
	 */
	public function render_quality_field() {
		$quality = KaiGen_Image_Provider::get_quality_setting();
		?>
		<select name="kaigen_quality_settings[quality]">
			<option value="low" <?php selected($quality, 'low'); ?>>Low</option>
			<option value="medium" <?php selected($quality, 'medium'); ?>>Medium</option>
			<option value="high" <?php selected($quality, 'high'); ?>>High</option>
		</select>
		<p class="description">Select the quality level for generated images. Higher quality may result in longer generation times.</p>
		<?php
	}

	/**
	 * Renders the API key field for a provider.
	 * 
	 * @param array $args The field arguments.
	 */
	public function render_api_key_field($args) {
		$provider_id = $args['provider_id'];
		$api_keys = get_option('kaigen_provider_api_keys', []);
		$value = isset($api_keys[$provider_id]) ? $api_keys[$provider_id] : '';
		?>
		<input type="password" 
			   id="kaigen_<?php echo esc_attr($provider_id); ?>_api_key"
			   name="kaigen_provider_api_keys[<?php echo esc_attr($provider_id); ?>]"
			   value="<?php echo esc_attr($value); ?>"
			   class="regular-text">
		<button type="button" 
				class="button kaigen-remove-key" 
				data-provider="<?php echo esc_attr($provider_id); ?>">
			Remove Key
		</button>
		<?php
	}

	/**
	 * Renders the provider selection field.
	 */
	public function render_provider_field($args) {
		$provider = get_option('kaigen_provider', '');
		?>
		<select name="kaigen_provider">
			<option value="">Select Provider</option>
			<?php foreach ($args['providers'] as $provider_id) : ?>
				<option value="<?php echo esc_attr($provider_id); ?>" 
						<?php selected($provider, $provider_id); ?>>
					<?php echo esc_html($this->providers[$provider_id]); ?>
				</option>
			<?php endforeach; ?>
		</select>
		<p class="description">Select the provider to use for image generation. This provider will be used as the default when generating images.</p>
		<?php
	}

	/**
	 * Sanitizes the provider setting.
	 * 
	 * @param string $input The input value for the provider.
	 * @return string The sanitized provider value.
	 */
	public function sanitize_provider($input) {
		$sanitized_input = sanitize_text_field($input);
		// Allow any valid provider to be selected, not just active ones
		if (!empty($sanitized_input) && !array_key_exists($sanitized_input, $this->providers)) {
			return '';
		}
		return $sanitized_input;
	}

	/**
	 * Preloads the KaiGen logo for faster display in the block editor.
	 */
	public function preload_logo() {
		$screen = get_current_screen();
		if ($screen && $screen->is_block_editor()) {
			$logo_url = plugin_dir_url(dirname(__FILE__)) . 'assets/KaiGen-logo-128x128.png';
			echo '<link rel="preload" href="' . esc_url($logo_url) . '" as="image" type="image/png">' . "\n";
		}
	}

	/**
	 * Enqueues the necessary scripts and styles for the admin interface.
	 * 
	 * @param string $hook The current admin page hook.
	 */
	public function enqueue_scripts($hook) {
		// Enqueue block editor scripts
		if (in_array($hook, ['post.php', 'post-new.php'])) {
			// Get the provider setting
			$provider = get_option('kaigen_provider', '');

			// If no provider is set but we have active providers, use OpenAI if available, otherwise use the first active provider
			if (empty($provider)) {
				$active_providers = $this->get_active_providers(); // Get fresh list instead of cached
				if (!empty($active_providers)) {
					$api_keys = get_option('kaigen_provider_api_keys', []);
					if (isset($api_keys['openai']) && !empty($api_keys['openai'])) {
						$provider = 'openai';
					} else {
						$provider = $active_providers[0];
					}
				}
			}

			// Enqueue admin CSS for block editor
			wp_enqueue_style(
				'kaigen-admin',
				plugin_dir_url(dirname(__FILE__)) . 'assets/kaigen-admin.css',
				[],
				'1.0.1'
			);

			wp_enqueue_script(
				'kaigen-editor',
				plugin_dir_url(dirname(__FILE__)) . 'build/index.js',
				['wp-blocks', 'wp-element', 'wp-editor', 'wp-components', 'wp-i18n'],
				'1.0.0',
				true
			);

			// Add localized data for the editor
			wp_localize_script('kaigen-editor', 'kaiGen', [
				'ajaxUrl' => admin_url('admin-ajax.php'),
				'nonce' => wp_create_nonce('kaigen_nonce'),
				'provider' => $provider,
				'supportsImageToImage' => $this->provider_supports_image_to_image($provider),
				'logoUrl' => plugin_dir_url(dirname(__FILE__)) . 'assets/KaiGen-logo-128x128.png',
			]);
		} else if ( in_array( $hook, ['settings_page_kaigen-settings'] ) ) {
			wp_enqueue_style(
				'kaigen-admin',
				plugin_dir_url(dirname(__FILE__)) . 'assets/kaigen-admin.css',
				[],
				'1.0.1'
			);
			wp_enqueue_script(
				'kaigen-admin',
				plugin_dir_url(dirname(__FILE__)) . 'build/admin.js',
				[],
				'1.0.0',
				true
			);
		}
	}

	/**
	 * Enqueues styles inside the block editor iframe (WP 5.8+).
	 * This is needed because the block editor canvas is inside an iframe.
	 */
	public function enqueue_block_editor_styles() {
		// Only load in admin/editor context
		if ( ! is_admin() ) {
			return;
		}

		wp_enqueue_style(
			'kaigen-editor-iframe',
			plugin_dir_url(dirname(__FILE__)) . 'assets/kaigen-admin.css',
			[],
			'1.0.2'
		);
	}

	/**
	 * Gets the list of active providers.
	 * @return array The list of active providers.
	 */
	public function get_active_providers() {
		// Get the api keys from the options table
		$api_keys = get_option('kaigen_provider_api_keys', []);

		// Return the providers that have an api key set
		$active_providers = [];
		foreach ($this->providers as $provider_id => $provider_name) {
			if (isset($api_keys[$provider_id]) && !empty($api_keys[$provider_id])) {
				$active_providers[] = $provider_id;
			}
		}
		return $active_providers;
	}

	/**
	 * Adds a settings link to the plugin's action links on the WordPress plugins page.
	 * 
	 * @param array $links The existing action links.
	 * @return array The modified action links.
	 */
	public function add_plugin_action_links($links) {
		$settings_link = '<a href="' . admin_url('options-general.php?page=kaigen-settings') . '">' . __('Settings', 'kaigen') . '</a>';
		array_unshift($links, $settings_link);
		return $links;
	}

	/**
	 * Checks if a provider supports image-to-image generation.
	 * 
	 * @param string $provider The provider ID.
	 * @return bool True if the provider supports image-to-image generation, false otherwise.
	 */
	private function provider_supports_image_to_image($provider) {
		if (empty($provider)) {
		return false;
		}
		
		$provider_manager = kaigen_provider_manager();
		return $provider_manager->provider_supports_image_to_image($provider);
	}

	/**
	 * Registers the reference image meta and edit form fields.
	 *
	 * @return void
	 */
	public function register_reference_image_meta() {
		register_post_meta(
			'attachment',
			'kaigen_reference_image',
			[
				'show_in_rest'  => true,
				'single'        => true,
				'type'          => 'boolean',
				'auth_callback' => function() {
					return current_user_can( 'upload_files' );
				},
			]
		);
		
		add_filter('attachment_fields_to_edit', [$this, 'add_reference_field'], 10, 2);
		add_filter('attachment_fields_to_save', [$this, 'save_reference_field'], 10, 2);
	}

	/**
	 * Adds the reference image checkbox to the attachment edit form.
	 *
	 * @param array   \$form_fields Current form fields.
	 * @param WP_Post \$post        Attachment post.
	 * @return array Modified form fields.
	 */
	public function add_reference_field($form_fields, $post) {
		$value = (bool) get_post_meta($post->ID, 'kaigen_reference_image', true);
		$form_fields['kaigen_reference_image'] = [
			'label' => __('Reference Image', 'kaigen'),
			'input' => 'html',
			'html'  => '<input type="checkbox" name="attachments[' . esc_attr($post->ID) . '][kaigen_reference_image]" value="1"' . checked($value, true, false) . '/>',
		];
		return $form_fields;
	}

	/**
	 * Saves the reference image checkbox value.
	 *
	 * @param array \$post       Attachment post data.
	 * @param array \$attachment Attachment form fields.
	 * @return array Modified post data.
	 */
	public function save_reference_field($post, $attachment) {
		$value = isset($attachment['kaigen_reference_image']) ? 1 : 0;
		update_post_meta($post['ID'], 'kaigen_reference_image', $value);
		return $post;
	}
}

/**
 * Gets the singleton instance of the admin class.
 * @return KaiGen_Admin The admin instance.
 */
function kaigen_admin() {
	return KaiGen_Admin::get_instance();
}

// Initialize the admin functionality
kaigen_admin();
