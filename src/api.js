// This file provides API functions for generating AI images.

/**
 * Generates an AI image based on the given prompt and optional parameters.
 *
 * @param {string} prompt - The text prompt for image generation.
 * @param {function} callback - The callback function to handle the generated image data.
 * @param {Object} [options] - Optional parameters for image generation.
 * @param {string} [options.sourceImageUrl] - URL of the source image for image-to-image generation.
 * @param {string[]} [options.additionalImageUrls] - Array of additional source image URLs (for GPT Image-1 only).
 * @param {string} [options.maskUrl] - URL of mask image for inpainting (for GPT Image-1 only).
 * @param {string} [options.moderation] - Moderation level: 'auto' or 'low' (for GPT Image-1 only).
 * @param {string} [options.style] - Style parameter: 'natural' or 'vivid' (for GPT Image-1 only).
 * @returns {Promise<void>} A promise that resolves when the image generation is complete.
 */
export const generateImage = async (prompt, callback, options = {}) => {
    try {
        // Get the provider setting from editor settings
        const provider = wp.data.select('core/editor')?.getEditorSettings()?.kaigen_provider;
        if (!provider) {
            throw new Error('No provider configured. Please check your plugin settings.');
        }
        
        const data = { 
            prompt,
            provider: provider
        };
        
        // Add source image URL if provided
        if (options.sourceImageUrl) {
            data.source_image_url = options.sourceImageUrl;
        }
        
        // Add array of additional image URLs if provided
        if (options.additionalImageUrls && Array.isArray(options.additionalImageUrls)) {
            data.additional_image_urls = options.additionalImageUrls;
        }
        
        // Add mask URL if provided for inpainting
        if (options.maskUrl) {
            data.mask_url = options.maskUrl;
        }
        

        // Add moderation level if provided
        if (options.moderation && ['auto', 'low'].includes(options.moderation)) {
            data.moderation = options.moderation;
        }
        
        // Add style if provided
        if (options.style && ['natural', 'vivid'].includes(options.style)) {
            data.style = options.style;
        }
        
        // Add fidelity if provided
        if (options.fidelity) {
            data.fidelity = options.fidelity;
        }

        const response = await wp.apiFetch({
            path: '/kaigen/v1/generate-image',
            method: 'POST',
            data: data,
        });

        // Handle WP_Error responses which come back as objects with 'code' and 'message' properties
        if (response.code && response.message) {
            // Special handling for content moderation errors
            if (response.code === 'content_moderation') {
                throw new Error(response.message);
            }
            // Handle other specific error codes as needed
            if (response.code === 'replicate_error') {
                throw new Error('Image generation failed: ' + response.message);
            }
            // Generic error handling for other WP_Error responses
            throw new Error(response.message);
        }

        // Handle successful response with URL
        if (response && response.url) {
            // Check if we have a valid WordPress media ID (a number greater than 0)
            if (response.id && typeof response.id === 'number' && response.id > 0) {
                // This is a WordPress media library attachment with a valid ID
                callback({
                    url: response.url,
                    alt: prompt,
                    id: response.id, // Use the actual WordPress media ID
                    caption: '',
                });
            } else {
                // This is just a URL with no valid WordPress media ID
                // Create an object without an ID to prevent 404 errors
                callback({
                    url: response.url,
                    alt: prompt,
                    caption: '',
                    // Omit the id property completely
                });
            }
        } else {
            // Handle invalid response format
            throw new Error('Invalid response from server: ' + JSON.stringify(response));
        }
    } catch (error) {
        // Log detailed error information
        console.error('Image generation failed:', error);
        if (error.message) console.error('Error message:', error.message);
        if (error.stack) console.error('Error stack:', error.stack);
        
        // Pass the error back to the callback
        callback({ 
            error: error.message || 'An unknown error occurred while generating the image'
        });
    }
};

/**
 * Fetches all reference images marked in the media library.
 *
 * @returns {Promise<Array>} Array of image objects.
 */
export const fetchReferenceImages = async () => {
    try {
        const response = await wp.apiFetch({
            path: '/kaigen/v1/reference-images',
            method: 'GET',
        });
        return Array.isArray(response) ? response : [];
    } catch (error) {
        console.error('Failed to fetch reference images:', error);
        return [];
    }
};