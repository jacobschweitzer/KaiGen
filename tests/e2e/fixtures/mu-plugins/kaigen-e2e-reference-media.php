<?php
/**
 * Provides reference media fixtures for KaiGen E2E tests.
 *
 * @package KaiGen
 */

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'kaigen-e2e/v1',
			'/reference-media',
			[
				'methods'             => 'POST',
				'permission_callback' => function () {
					return current_user_can( 'upload_files' );
				},
				'callback'            => function () {
					$png      = base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' );
					$fixtures = [
						[
							'filename' => 'kaigen-reference-marked.png',
							'alt'      => 'KaiGen marked reference fixture',
							'marked'   => true,
						],
						[
							'filename' => 'kaigen-reference-unmarked.png',
							'alt'      => 'KaiGen unmarked image fixture',
							'marked'   => false,
						],
					];
					$created  = [];

					foreach ( $fixtures as $fixture ) {
						$upload = wp_upload_bits( $fixture['filename'], null, $png );

						if ( ! empty( $upload['error'] ) ) {
							return new WP_Error( 'e2e_reference_upload_failed', $upload['error'], [ 'status' => 500 ] );
						}

						$attachment_id = wp_insert_attachment(
							[
								'post_mime_type' => 'image/png',
								'post_title'     => sanitize_text_field( $fixture['alt'] ),
								'post_content'   => '',
								'post_status'    => 'inherit',
							],
							$upload['file']
						);

						if ( is_wp_error( $attachment_id ) ) {
							return $attachment_id;
						}

						update_post_meta( $attachment_id, '_wp_attachment_image_alt', $fixture['alt'] );
						update_post_meta( $attachment_id, 'kaigen_reference_image', $fixture['marked'] ? 1 : 0 );

						$created[] = [
							'id'     => $attachment_id,
							'url'    => wp_get_attachment_url( $attachment_id ),
							'alt'    => $fixture['alt'],
							'marked' => $fixture['marked'],
						];
					}

					return rest_ensure_response( $created );
				},
			]
		);
	}
);
