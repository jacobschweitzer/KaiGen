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
	 * Supported generated image MIME types.
	 *
	 * @var array
	 */
	private const EXTENSION_MAP = [
		'image/jpeg' => 'jpg',
		'image/png'  => 'png',
		'image/webp' => 'webp',
	];

	/**
	 * Uploads an image to the WordPress media library.
	 *
	 * @param string $image_data The raw image data or URL.
	 * @param string $prompt The prompt used to generate the image.
	 * @param array  $metadata Core AI result metadata.
	 * @return array|WP_Error Array containing the uploaded image URL and ID, or WP_Error on failure.
	 */
	public static function upload_to_media_library( $image_data, $prompt, $metadata = [] ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$sideload_file = self::prepare_sideload_file( $image_data, $prompt );
		if ( is_wp_error( $sideload_file ) ) {
			return $sideload_file;
		}

		$attachment_id = media_handle_sideload(
			$sideload_file,
			0,
			self::build_attachment_title( $prompt )
		);

		if ( is_wp_error( $attachment_id ) ) {
			if ( file_exists( $sideload_file['tmp_name'] ) ) {
				wp_delete_file( $sideload_file['tmp_name'] );
			}

			return $attachment_id;
		}

		wp_update_post(
			[
				'ID'           => $attachment_id,
				'post_title'   => self::build_attachment_title( $prompt ),
				'post_content' => self::build_attachment_description( $prompt, $metadata ),
				'post_excerpt' => wp_strip_all_tags( $prompt ),
			]
		);
		update_post_meta( $attachment_id, '_wp_attachment_image_alt', wp_strip_all_tags( $prompt ) );

		return [
			'url'    => wp_get_attachment_url( $attachment_id ),
			'id'     => $attachment_id,
			'status' => 'completed',
		];
	}

	/**
	 * Prepares generated image data as a sideload file for WordPress media helpers.
	 *
	 * @param string $image_data The raw image data, data URI, or URL.
	 * @param string $prompt The prompt used to generate the image.
	 * @return array|\WP_Error Sideload file array or WP_Error on failure.
	 */
	private static function prepare_sideload_file( $image_data, $prompt ) {
		if ( filter_var( $image_data, FILTER_VALIDATE_URL ) ) {
			return self::prepare_remote_sideload_file( $image_data, $prompt );
		}

		return self::prepare_inline_sideload_file( $image_data, $prompt );
	}

	/**
	 * Downloads a remote generated image into a temporary sideload file.
	 *
	 * @param string $url The remote image URL.
	 * @param string $prompt The prompt used to generate the image.
	 * @return array|\WP_Error Sideload file array or WP_Error on failure.
	 */
	private static function prepare_remote_sideload_file( $url, $prompt ) {
		$temp_file = download_url( $url, 60 );
		if ( is_wp_error( $temp_file ) ) {
			return $temp_file;
		}

		$mime_type = wp_get_image_mime( $temp_file );
		$extension = self::get_extension_for_mime_type( $mime_type );

		if ( '' === $extension ) {
			wp_delete_file( $temp_file );

			return new \WP_Error( 'unsupported_image_type', __( 'Generated image type is not supported.', 'kaigen' ) );
		}

		return [
			'name'     => self::build_filename( $prompt, $extension ),
			'tmp_name' => $temp_file,
			'type'     => $mime_type,
			'error'    => 0,
			'size'     => filesize( $temp_file ),
		];
	}

	/**
	 * Writes inline generated image data into a temporary sideload file.
	 *
	 * @param string $image_data Raw binary image data or a data URI.
	 * @param string $prompt The prompt used to generate the image.
	 * @return array|\WP_Error Sideload file array or WP_Error on failure.
	 */
	private static function prepare_inline_sideload_file( $image_data, $prompt ) {
		$image_data = self::decode_inline_image_data( $image_data );
		if ( is_wp_error( $image_data ) ) {
			return $image_data;
		}

		$image_info = getimagesizefromstring( $image_data );
		$mime_type  = $image_info['mime'] ?? '';
		$extension  = self::get_extension_for_mime_type( $mime_type );

		if ( '' === $extension ) {
			return new \WP_Error( 'unsupported_image_type', __( 'Generated image type is not supported.', 'kaigen' ) );
		}

		$temp_file = wp_tempnam( self::build_filename( $prompt, $extension ) );
		if ( ! $temp_file ) {
			return new \WP_Error( 'temp_file_error', __( 'Could not create a temporary file for the generated image.', 'kaigen' ) );
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- Temporary sideload file for WordPress media handling.
		if ( false === file_put_contents( $temp_file, $image_data ) ) {
			wp_delete_file( $temp_file );

			return new \WP_Error( 'temp_file_error', __( 'Could not write the generated image to a temporary file.', 'kaigen' ) );
		}

		return [
			'name'     => self::build_filename( $prompt, $extension ),
			'tmp_name' => $temp_file,
			'type'     => $mime_type,
			'error'    => 0,
			'size'     => filesize( $temp_file ),
		];
	}

	/**
	 * Decodes a generated inline image payload.
	 *
	 * @param string $image_data Raw binary image data or a data URI.
	 * @return string|\WP_Error Raw binary image data or WP_Error on failure.
	 */
	private static function decode_inline_image_data( $image_data ) {
		if ( preg_match( '/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i', $image_data, $matches ) ) {
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Decodes generated image data URIs from the AI Client.
			$decoded = base64_decode( $matches[1], true );

			if ( false === $decoded ) {
				return new \WP_Error( 'invalid_image_data', __( 'Generated image data is not valid base64.', 'kaigen' ) );
			}

			return $decoded;
		}

		return $image_data;
	}

	/**
	 * Builds a generated image filename from the prompt and image extension.
	 *
	 * @param string $prompt The generation prompt.
	 * @param string $extension The image file extension.
	 * @return string Generated image filename.
	 */
	private static function build_filename( $prompt, $extension ) {
		$prompt_slug = substr( sanitize_title( $prompt ), 0, 50 );

		if ( '' === $prompt_slug ) {
			$prompt_slug = 'image';
		}

		return sprintf( 'ai-%1$s.%2$s', $prompt_slug, $extension );
	}

	/**
	 * Gets the file extension for a generated image MIME type.
	 *
	 * @param string $mime_type Image MIME type.
	 * @return string File extension, or empty string when unsupported.
	 */
	private static function get_extension_for_mime_type( $mime_type ) {
		return self::EXTENSION_MAP[ $mime_type ] ?? '';
	}

	/**
	 * Builds an attachment title from the prompt.
	 *
	 * @param string $prompt The generation prompt.
	 * @return string Attachment title.
	 */
	private static function build_attachment_title( $prompt ) {
		return wp_trim_words( wp_strip_all_tags( $prompt ), 12, '' );
	}

	/**
	 * Builds a Core-style generated image attachment description.
	 *
	 * @param string $prompt The generation prompt.
	 * @param array  $metadata Core AI result metadata.
	 * @return string Attachment description.
	 */
	private static function build_attachment_description( $prompt, $metadata ) {
		$provider = self::get_metadata_name( $metadata, [ 'provider_metadata', 'provider' ] );
		$model    = self::get_metadata_name( $metadata, [ 'model_metadata', 'model' ] );
		$date     = wp_date( 'n/j/Y' );

		if ( '' !== $provider && '' !== $model ) {
			return sprintf(
				'Generated by %1$s using %2$s on %3$s. Prompt: %4$s',
				$provider,
				$model,
				$date,
				wp_strip_all_tags( $prompt )
			);
		}

		if ( '' !== $provider ) {
			return sprintf(
				'Generated by %1$s on %2$s. Prompt: %3$s',
				$provider,
				$date,
				wp_strip_all_tags( $prompt )
			);
		}

		return sprintf(
			'Generated on %1$s. Prompt: %2$s',
			$date,
			wp_strip_all_tags( $prompt )
		);
	}

	/**
	 * Gets a display name from possible metadata locations.
	 *
	 * @param array $metadata Core AI result metadata.
	 * @param array $keys Possible top-level metadata keys.
	 * @return string Metadata display name.
	 */
	private static function get_metadata_name( $metadata, $keys ) {
		foreach ( $keys as $key ) {
			if ( empty( $metadata[ $key ] ) ) {
				continue;
			}

			if ( is_array( $metadata[ $key ] ) ) {
				if ( ! empty( $metadata[ $key ]['name'] ) ) {
					return sanitize_text_field( (string) $metadata[ $key ]['name'] );
				}

				if ( ! empty( $metadata[ $key ]['id'] ) ) {
					return sanitize_text_field( (string) $metadata[ $key ]['id'] );
				}
			}

			if ( is_string( $metadata[ $key ] ) ) {
				return sanitize_text_field( $metadata[ $key ] );
			}
		}

		return '';
	}
}
