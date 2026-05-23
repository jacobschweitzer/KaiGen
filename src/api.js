// This file provides API functions for generating AI images.

/**
 * Generates an AI image based on the given prompt and optional parameters.
 *
 * @param {string}   prompt                   - The text prompt for image generation.
 * @param {Function} callback                 - The callback function to handle the generated image data.
 * @param {Object}   [options]                - Optional parameters for image generation.
 * @param {number[]} [options.sourceImageIds] - Array of reference image IDs.
 * @param {string}   [options.provider]       - Core AI provider ID, or 'auto'.
 * @param {string}   [options.orientation]    - Core orientation: square, landscape, or portrait.
 * @return {Promise<void>} A promise that resolves when the image generation is complete.
 */
export const generateImage = async ( prompt, callback, options = {} ) => {
	try {
		const data = {
			prompt,
			provider: options.provider || 'auto',
			orientation: options.orientation || 'square',
		};

		if (
			options.sourceImageIds &&
			Array.isArray( options.sourceImageIds )
		) {
			data.source_image_ids = options.sourceImageIds;
		}

		const response = await wp.apiFetch( {
			path: '/kaigen/v1/generate-image',
			method: 'POST',
			data,
		} );

		// Handle WP_Error responses which come back as objects with 'code' and 'message' properties
		if ( response.code && response.message ) {
			// Special handling for content moderation errors
			if ( response.code === 'content_moderation' ) {
				throw new Error( response.message );
			}
			// Handle other specific error codes as needed
			if ( response.code === 'replicate_error' ) {
				throw new Error(
					'Image generation failed: ' + response.message
				);
			}
			// Generic error handling for other WP_Error responses
			throw new Error( response.message );
		}

		// Handle successful response with URL
		if ( response && response.url ) {
			// Check if we have a valid WordPress media ID (a number greater than 0)
			if (
				response.id &&
				typeof response.id === 'number' &&
				response.id > 0
			) {
				// This is a WordPress media library attachment with a valid ID
				callback( {
					url: response.url,
					alt: prompt,
					id: response.id, // Use the actual WordPress media ID
					caption: '',
					metadata: response.metadata || null,
				} );
			} else {
				// This is just a URL with no valid WordPress media ID
				// Create an object without an ID to prevent 404 errors
				callback( {
					url: response.url,
					alt: prompt,
					caption: '',
					metadata: response.metadata || null,
					// Omit the id property completely
				} );
			}
		} else {
			// Handle invalid response format
			throw new Error(
				'Invalid response from server: ' + JSON.stringify( response )
			);
		}
	} catch ( error ) {
		// Pass the error back to the callback - UI will display it to users
		callback( {
			error:
				error.message ||
				'An unknown error occurred while generating the image',
		} );
	}
};

/**
 * Fetches configured image-capable providers from the WordPress AI Client.
 *
 * @return {Promise<Array>} Provider option objects.
 */
export const fetchImageProviders = async () => {
	const fallbackProviders = [ { id: 'auto', name: 'Auto' } ];

	try {
		const providers = await wp.apiFetch( {
			path: '/kaigen/v1/providers',
			method: 'GET',
		} );

		return Array.isArray( providers ) && providers.length
			? providers
			: fallbackProviders;
	} catch ( error ) {
		return fallbackProviders;
	}
};

/**
 * Fetches all reference images marked in the media library.
 *
 * @return {Promise<Array>} Array of image objects.
 */
export const fetchReferenceImages = async () => {
	try {
		const response = await wp.apiFetch( {
			path: '/kaigen/v1/reference-images',
			method: 'GET',
		} );
		return Array.isArray( response ) ? response : [];
	} catch ( error ) {
		// Silently fail and return empty array
		return [];
	}
};
