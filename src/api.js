// This file provides API functions for generating AI images.

/**
 * Generates an AI image based on the given prompt and optional parameters.
 *
 * @param {string}   prompt                   The text prompt for image generation.
 * @param {Object}   [options]                Optional parameters for image generation.
 * @param {number[]} [options.sourceImageIds] Array of reference image IDs.
 * @param {string}   [options.provider]       Core AI provider ID, or 'auto'.
 * @param {string}   [options.orientation]    Core orientation: square, landscape, or portrait.
 * @return {Promise<Object>} Generated media object.
 */
export const generateImage = async ( prompt, options = {} ) => {
	const data = {
		prompt,
		provider: options.provider || 'auto',
		orientation: options.orientation || 'square',
	};

	if ( options.sourceImageIds && Array.isArray( options.sourceImageIds ) ) {
		data.source_image_ids = options.sourceImageIds;
	}

	let response;
	try {
		response = await wp.apiFetch( {
			path: '/kaigen/v1/generate-image',
			method: 'POST',
			data,
		} );
	} catch ( error ) {
		throw new Error(
			error.message ||
				'An unknown error occurred while generating the image'
		);
	}

	if ( response.code && response.message ) {
		throw new Error( response.message );
	}

	if ( ! response || ! response.url ) {
		throw new Error(
			'Invalid response from server: ' + JSON.stringify( response )
		);
	}

	const media = {
		url: response.url,
		alt: prompt,
		caption: '',
		metadata: response.metadata || null,
	};

	if ( response.id && typeof response.id === 'number' && response.id > 0 ) {
		media.id = response.id;
	}

	return media;
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
