<?php
/**
 * Image Handler class for KaiGen plugin.
 *
 * @package KaiGen
 */

namespace KaiGen;

/**
 * Class for handling common image operations in KaiGen plugin.
 *
 * @package KaiGen
 */
class Image_Handler {
	/**
	 * Downloads an image from a given URL.
	 *
	 * @param string $url The URL of the image to download.
	 * @return string|WP_Error The image data or WP_Error on failure.
	 */
	public static function download_image( $url ) {
		$response = wp_remote_get( $url, [ 'timeout' => 60 ] );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$image_data = wp_remote_retrieve_body( $response );

		if ( empty( $image_data ) ) {
			return new WP_Error( 'empty_image', 'Downloaded image data is empty' );
		}

		return $image_data;
	}

	/**
	 * Uploads an image to the WordPress media library.
	 *
	 * @param string $image_data The raw image data or URL.
	 * @param string $prompt The prompt used to generate the image (for alt text).
	 * @return array|WP_Error Array containing the uploaded image URL and ID, or WP_Error on failure.
	 */
	public static function upload_to_media_library( $image_data, $prompt ) {
		// Download the image if a URL is provided.
		if ( filter_var( $image_data, FILTER_VALIDATE_URL ) ) {
			$image_data = self::download_image( $image_data );
			if ( is_wp_error( $image_data ) ) {
				return $image_data;
			}
		}

		// Create a sanitized prompt-based filename (max 50 chars).
		$prompt_slug = sanitize_title( $prompt );
		$prompt_slug = substr( $prompt_slug, 0, 50 ); // Limit length.

		$mime_type = '';
		$image_info = getimagesizefromstring( $image_data );
		if ( ! empty( $image_info['mime'] ) ) {
			$mime_type = $image_info['mime'];
		}

		// Match the filename extension to the actual image data for reliable attachments (e.g., E2E base64 PNGs).
		$extension_map = [
			'image/jpeg' => 'jpg',
			'image/png'  => 'png',
			'image/webp' => 'webp',
		];
		$extension = $extension_map[ $mime_type ] ?? 'webp';

		// Generate a filename with prompt and unique ID.
		$filename = 'ai-' . $prompt_slug . '-' . uniqid() . '.' . $extension;

		$upload = wp_upload_bits( $filename, null, $image_data );

		if ( $upload['error'] ) {
			return new WP_Error( 'upload_error', $upload['error'] );
		}

		if ( ! file_exists( $upload['file'] ) || ! is_readable( $upload['file'] ) ) {
			return new WP_Error( 'file_error', 'Uploaded file does not exist or is not readable' );
		}

		$filetype = wp_check_filetype( $filename, null );

		// Create a reasonable title from the prompt.
		$title = wp_trim_words( $prompt, 10, '...' );
		$title = 'AI Image: ' . ucfirst( $title );

		$attachment = [
			'post_mime_type' => $filetype['type'],
			'post_title'     => $title,
			'post_content'   => 'Generated with prompt: ' . $prompt,
			'post_status'    => 'inherit',
			'post_excerpt'   => wp_trim_words( $prompt, 5, '...' ),
		];

		$attach_id = wp_insert_attachment( $attachment, $upload['file'] );

		if ( is_wp_error( $attach_id ) ) {
			return $attach_id;
		}

		update_post_meta( $attach_id, '_wp_attachment_image_alt', wp_strip_all_tags( $prompt ) );

		require_once ABSPATH . 'wp-admin/includes/image.php';
		$attach_data = wp_generate_attachment_metadata( $attach_id, $upload['file'] );
		wp_update_attachment_metadata( $attach_id, $attach_data );

		return [
			'url'    => wp_get_attachment_url( $attach_id ),
			'id'     => $attach_id,
			'status' => 'completed',
		];
	}

	/**
	 * Converts a data URI to an image file and saves it.
	 *
	 * @param string $data_uri The data URI containing the image data.
	 * @return string|WP_Error The URL of the saved image file or WP_Error on failure.
	 */
	public static function data_uri_to_image( $data_uri ) {
		$parts = explode( ',', $data_uri, 2 );
		if ( count( $parts ) !== 2 ) {
			return new WP_Error( 'invalid_uri', 'Invalid data URI format.' );
		}

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Used for legitimate data URI decoding.
		$image_data = base64_decode( $parts[1] );
		$mime_type  = explode( ';', $parts[0] )[0];
		$mime_type  = str_replace( 'data:', '', $mime_type );

		$extension = '.png';
		if ( 'image/jpeg' === $mime_type ) {
			$extension = '.jpg';
		} elseif ( 'image/webp' === $mime_type ) {
			$extension = '.webp';
		}

		$filename   = 'ai_generated_' . uniqid() . $extension;
		$upload_dir = wp_upload_dir();
		$file_path  = trailingslashit( $upload_dir['path'] ) . $filename;
		$file_url   = trailingslashit( $upload_dir['url'] ) . $filename;

		// Initialize WP_Filesystem.
		global $wp_filesystem;
		if ( empty( $wp_filesystem ) ) {
			require_once ABSPATH . '/wp-admin/includes/file.php';
			WP_Filesystem();
		}

		// Use WP_Filesystem to write the file.
		if ( ! $wp_filesystem->put_contents( $file_path, $image_data, FS_CHMOD_FILE ) ) {
			return new WP_Error( 'save_failed', 'Failed to save the image file.' );
		}

		return $file_url;
	}
}
