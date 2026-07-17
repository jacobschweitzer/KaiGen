<?php
/**
 * Mocks KaiGen image generation for deterministic E2E tests.
 *
 * @package KaiGen
 */

add_filter(
	'rest_pre_dispatch',
	function ( $result, $server, $request ) {
		if ( ! defined( 'E2E_TESTING' ) || ! E2E_TESTING ) {
			return $result;
		}

		$route  = $request->get_route();
		$method = $request->get_method();

		if ( '/kaigen/v1/generate-image' !== $route || 'POST' !== $method ) {
			return $result;
		}

		if ( ! current_user_can( 'upload_files' ) ) {
			return new WP_Error( 'rest_forbidden', 'Sorry, you are not allowed to use this KaiGen E2E fixture.', [ 'status' => rest_authorization_required_code() ] );
		}

		$prompt = sanitize_textarea_field( (string) $request->get_param( 'prompt' ) );

		require_once ABSPATH . 'wp-admin/includes/image.php';
		$png    = base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' );
		$upload = wp_upload_bits( 'kaigen-generated-e2e.png', null, $png );

		if ( ! empty( $upload['error'] ) ) {
			return new WP_Error( 'e2e_upload_failed', $upload['error'], [ 'status' => 500 ] );
		}

		$attachment_id = wp_insert_attachment(
			[
				'post_mime_type' => 'image/png',
				'post_title'     => 'KaiGen generated E2E image',
				'post_content'   => '',
				'post_status'    => 'inherit',
			],
			$upload['file']
		);

		if ( is_wp_error( $attachment_id ) ) {
			return $attachment_id;
		}

		wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $upload['file'] ) );

		return rest_ensure_response(
			[
				'id'       => $attachment_id,
				'url'      => wp_get_attachment_url( $attachment_id ),
				'metadata' => [
					'provider_metadata' => [
						'provider' => 'e2e-alpha',
						'model'    => 'e2e-image-model',
					],
				],
			]
		);
	},
	10,
	3
);
