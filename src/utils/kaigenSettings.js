import { select } from '@wordpress/data';

export const DEFAULT_REFERENCE_IMAGE_LIMIT = 5;

/**
 * Gets KaiGen settings from the block editor settings payload.
 *
 * @return {Object} KaiGen settings.
 */
export const getKaiGenSettings = () => {
	const editorSettings = select( 'core/editor' )?.getEditorSettings() || {};
	return editorSettings.kaigen_settings || {};
};

/**
 * Checks whether image generation should be exposed in the editor.
 *
 * @return {boolean} Whether KaiGen has a usable AI backend.
 */
export const isKaiGenAvailable = () =>
	getKaiGenSettings().is_ai_client_available === true &&
	( getKaiGenSettings().providers || [] ).some(
		( provider ) => provider.id !== 'auto'
	);
