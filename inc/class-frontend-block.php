<?php
/**
 * Frontend image generator block registration.
 *
 * @package KaiGen
 */

namespace KaiGen;

/**
 * Registers and renders the frontend image generator block.
 */
class Frontend_Block {
	/**
	 * Singleton instance.
	 *
	 * @var Frontend_Block|null
	 */
	private static $instance = null;

	/**
	 * Gets the singleton instance.
	 *
	 * @return Frontend_Block
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		add_action( 'init', [ $this, 'register_block' ] );
	}

	/**
	 * Registers scripts and block type.
	 *
	 * @return void
	 */
	public function register_block() {
		$script_path = plugin_dir_path( __DIR__ ) . 'assets/kaigen-frontend-image-generator.js';
		$style_path  = plugin_dir_path( __DIR__ ) . 'assets/kaigen-frontend-image-generator.css';

		wp_register_script(
			'kaigen-frontend-image-generator',
			plugin_dir_url( __DIR__ ) . 'assets/kaigen-frontend-image-generator.js',
			[],
			file_exists( $script_path ) ? (string) filemtime( $script_path ) : '0.2.10',
			true
		);

		wp_register_style(
			'kaigen-frontend-image-generator',
			plugin_dir_url( __DIR__ ) . 'assets/kaigen-frontend-image-generator.css',
			[],
			file_exists( $style_path ) ? (string) filemtime( $style_path ) : '0.2.10'
		);

		register_block_type(
			'kaigen/frontend-image-generator',
			[
				'api_version'      => 2,
				'uses_context'     => [ 'postId' ],
				'attributes'       => [
					'quality'           => [
						'type'    => 'string',
						'default' => 'medium',
					],
					'promptInstruction' => [
						'type'    => 'string',
						'default' => __( 'Describe the image you want to create...', 'kaigen' ),
					],
				],
				'render_callback'  => [ $this, 'render_block' ],
				'supports'         => [
					'html' => false,
				],
			]
		);
	}

	/**
	 * Renders the frontend block output.
	 *
	 * @param array  $attributes Block attributes.
	 * @param string $content Saved content.
	 * @param object $block Block object.
	 * @return string
	 */
	public function render_block( $attributes, $content, $block ) {
		$quality = isset( $attributes['quality'] ) ? sanitize_key( $attributes['quality'] ) : 'medium';
		if ( ! in_array( $quality, [ 'low', 'medium', 'high' ], true ) ) {
			$quality = 'medium';
		}

		$prompt_instruction = isset( $attributes['promptInstruction'] ) ? sanitize_text_field( $attributes['promptInstruction'] ) : __( 'Describe the image you want to create...', 'kaigen' );
		if ( '' === $prompt_instruction ) {
			$prompt_instruction = __( 'Describe the image you want to create...', 'kaigen' );
		}

		$post_id = 0;
		if ( $block && isset( $block->context['postId'] ) ) {
			$post_id = absint( $block->context['postId'] );
		}

		if ( $post_id <= 0 ) {
			$post_id = absint( get_queried_object_id() );
		}

		if ( $post_id <= 0 && is_singular() ) {
			$post_id = absint( get_the_ID() );
		}

		wp_enqueue_script( 'kaigen-frontend-image-generator' );
		wp_enqueue_style( 'kaigen-frontend-image-generator' );
		wp_localize_script(
			'kaigen-frontend-image-generator',
			'kaigenFrontendData',
			[
				'generateImageUrl' => esc_url_raw( rest_url( 'kaigen/v1/frontend-generate-image' ) ),
				'userImagesUrl'    => esc_url_raw( rest_url( 'kaigen/v1/user-post-images' ) ),
				'nonce'            => wp_create_nonce( 'wp_rest' ),
				'isLoggedIn'       => is_user_logged_in(),
				'loginMessage'     => __( 'Please log in to generate images.', 'kaigen' ),
				'genericError'     => __( 'Unable to generate an image right now.', 'kaigen' ),
				'defaultPostId'    => $post_id,
				'defaultQuality'   => $quality,
				'buttonLabel'      => __( 'Generate Image', 'kaigen' ),
				'placeholder'      => $prompt_instruction,
				'yourImagesTitle'  => __( 'Your images for this post', 'kaigen' ),
				'promptInstruction' => $prompt_instruction,
			]
		);

		return sprintf(
			'<div class="kaigen-frontend-image-generator" data-post-id="%1$d" data-quality="%2$s" data-prompt-instruction="%3$s"></div>',
			absint( $post_id ),
			esc_attr( $quality ),
			esc_attr( $prompt_instruction )
		);
	}
}

Frontend_Block::get_instance();
