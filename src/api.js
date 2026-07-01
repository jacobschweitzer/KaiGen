// This file provides API functions for generating AI images.

import apiFetch from '@wordpress/api-fetch';
import {
	normalizePromptRefinements,
	replacePromptTerm,
} from './utils/promptRefinement';

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
		response = await apiFetch( {
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
		const response = await apiFetch( {
			path: '/kaigen/v1/reference-images',
			method: 'GET',
		} );
		return Array.isArray( response ) ? response : [];
	} catch {
		// Silently fail and return empty array
		return [];
	}
};

/**
 * Fetches model-generated prompt refinement choices.
 *
 * @param {string} prompt Prompt text.
 * @return {Promise<Array>} Prompt terms with refinement choices.
 */
export const fetchPromptRefinements = async ( prompt ) => {
	const promptText = typeof prompt === 'string' ? prompt : '';
	const requestPrompt = promptText.trim();

	if ( ! requestPrompt ) {
		return [];
	}

	let response;
	try {
		response = await apiFetch( {
			path: '/kaigen/v1/prompt-refinements',
			method: 'POST',
			data: {
				prompt: requestPrompt,
			},
		} );
	} catch ( error ) {
		throw new Error(
			error.message ||
				'An unknown error occurred while refining the prompt'
		);
	}

	return normalizePromptRefinements( promptText, response );
};

/**
 * Applies a selected prompt refinement choice to the full prompt.
 *
 * @param {string} prompt Prompt text.
 * @param {Object} term   Selected prompt term.
 * @param {string} choice Selected refinement choice.
 * @return {Promise<string>} Updated prompt.
 */
export const applyPromptRefinement = async ( prompt, term, choice ) => {
	const promptText = typeof prompt === 'string' ? prompt : '';
	const choiceText = typeof choice === 'string' ? choice.trim() : '';
	const fallbackPrompt = replacePromptTerm( promptText, term, choiceText );

	if ( ! promptText.trim() || ! term?.text || ! choiceText ) {
		return fallbackPrompt;
	}

	let response;
	try {
		response = await apiFetch( {
			path: '/kaigen/v1/apply-prompt-refinement',
			method: 'POST',
			data: {
				prompt: promptText,
				term: term.text,
				term_start: Number.isInteger( term.start ) ? term.start : null,
				term_end: Number.isInteger( term.end ) ? term.end : null,
				choice: choiceText,
			},
		} );
	} catch {
		return fallbackPrompt;
	}

	const appliedPrompt =
		typeof response?.prompt === 'string' ? response.prompt.trim() : '';

	return appliedPrompt || fallbackPrompt;
};
