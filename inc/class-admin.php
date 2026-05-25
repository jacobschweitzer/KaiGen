<?php
/**
 * Editor and Media Library integration for KaiGen.
 *
 * @package KaiGen
 */

namespace KaiGen;

/**
 * Handles WordPress admin/editor integration for KaiGen.
 */
class Admin {
	/**
	 * Holds the singleton instance of this class.
	 *
	 * @var Admin
	 */
	private static $instance = null;

	/**
	 * Initialize admin functionality.
	 */
	private function __construct() {
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_scripts' ] );
		add_action( 'admin_head', [ $this, 'preload_logo' ] );
		add_action( 'init', [ $this, 'register_reference_image_meta' ] );
		add_action( 'enqueue_block_assets', [ $this, 'enqueue_block_editor_styles' ] );
		add_filter( 'block_editor_settings_all', [ $this, 'add_editor_settings' ], 20 );
	}

	/**
	 * Gets the singleton instance of this class.
	 *
	 * @return Admin Admin instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Adds KaiGen settings to the block editor settings payload.
	 *
	 * @param array $settings Existing editor settings.
	 * @return array Updated editor settings.
	 */
	public function add_editor_settings( $settings ) {
		if ( ! is_array( $settings ) ) {
			$settings = [];
		}

		$providers = class_exists( Rest_API::class )
			? Rest_API::get_instance()->get_image_provider_options()
			: [
				[
					'id'   => 'auto',
					'name' => __( 'Auto', 'kaigen' ),
				],
			];

		$kaigen_settings = [
			'provider'               => 'auto',
			'providers'              => $providers,
			'orientation'            => 'square',
			'is_ai_client_available' => function_exists( 'wp_ai_client_prompt' ),
		];

		$settings['kaigen_settings'] = $kaigen_settings;
		$settings['kaigen']          = $kaigen_settings;

		return $settings;
	}

	/**
	 * Prefetches the KaiGen logo for faster display in the block editor.
	 *
	 * @return void
	 */
	public function preload_logo() {
		$screen = get_current_screen();
		if ( $screen && $screen->is_block_editor() ) {
			$logo_url = plugin_dir_url( __DIR__ ) . 'assets/KaiGen-logo-128x128.png';
			echo '<link rel="prefetch" href="' . esc_url( $logo_url ) . '" as="image" type="image/png">' . "\n";
		}
	}

	/**
	 * Enqueues block editor scripts and styles.
	 *
	 * @param string $hook The current admin page hook.
	 * @return void
	 */
	public function enqueue_scripts( $hook ) {
		if ( ! in_array( $hook, [ 'post.php', 'post-new.php' ], true ) ) {
			return;
		}

		$asset_file = plugin_dir_path( __DIR__ ) . 'build/index.asset.php';
		$asset      = file_exists( $asset_file )
			? include $asset_file
			: [
				'dependencies' => [ 'react', 'wp-api-fetch', 'wp-block-editor', 'wp-components', 'wp-data', 'wp-element', 'wp-hooks' ],
				'version'      => '1.0.0',
			];

		wp_enqueue_style(
			'kaigen-admin',
			plugin_dir_url( __DIR__ ) . 'assets/kaigen-admin.css',
			[],
			'1.0.2'
		);

		wp_enqueue_script(
			'kaigen-editor',
			plugin_dir_url( __DIR__ ) . 'build/index.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_localize_script(
			'kaigen-editor',
			'kaiGen',
			[
				'logoUrl' => plugin_dir_url( __DIR__ ) . 'assets/KaiGen-logo-128x128.png',
			]
		);
	}

	/**
	 * Enqueues styles inside the block editor iframe.
	 *
	 * @return void
	 */
	public function enqueue_block_editor_styles() {
		if ( ! is_admin() ) {
			return;
		}

		wp_enqueue_style(
			'kaigen-editor-iframe',
			plugin_dir_url( __DIR__ ) . 'assets/kaigen-admin.css',
			[],
			'1.0.2'
		);
	}

	/**
	 * Registers reference image metadata and edit form fields.
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
				'default'       => false,
				'auth_callback' => function () {
					return current_user_can( 'upload_files' );
				},
			]
		);

		add_filter( 'attachment_fields_to_edit', [ $this, 'add_reference_field' ], 10, 2 );
		add_filter( 'attachment_fields_to_save', [ $this, 'save_reference_field' ], 10, 2 );
	}

	/**
	 * Adds the reference image checkbox to attachment edit forms.
	 *
	 * @param array    $form_fields Current form fields.
	 * @param \WP_Post $post Attachment post.
	 * @return array Modified form fields.
	 */
	public function add_reference_field( $form_fields, $post ) {
		$meta_value = get_post_meta( $post->ID, 'kaigen_reference_image', true );
		$value      = ( 1 === $meta_value || true === $meta_value || '1' === $meta_value );

		$form_fields['kaigen_reference_image'] = [
			'label' => __( 'Reference Image', 'kaigen' ),
			'input' => 'html',
			'html'  => '<input type="checkbox" name="attachments[' . esc_attr( $post->ID ) . '][kaigen_reference_image]" value="1"' . checked( $value, true, false ) . '/>',
		];

		return $form_fields;
	}

	/**
	 * Saves the reference image checkbox value.
	 *
	 * @param array $post Attachment post data.
	 * @param array $attachment Attachment form fields.
	 * @return array Modified post data.
	 */
	public function save_reference_field( $post, $attachment ) {
		$value = isset( $attachment['kaigen_reference_image'] ) && '1' === $attachment['kaigen_reference_image'] ? 1 : 0;
		update_post_meta( $post['ID'], 'kaigen_reference_image', $value );
		return $post;
	}
}

// phpcs:disable Universal.Files.SeparateFunctionsFromOO.Mixed -- Helper function for singleton pattern is a common WordPress practice.
/**
 * Gets the singleton instance of the admin class.
 *
 * @return Admin The admin instance.
 */
function kaigen_admin() {
	return Admin::get_instance();
}
// phpcs:enable Universal.Files.SeparateFunctionsFromOO.Mixed

kaigen_admin();
