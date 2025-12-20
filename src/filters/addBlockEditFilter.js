// This file modifies the block editor for core/image blocks to include an AI image regeneration button.

import { addFilter } from '@wordpress/hooks';
import { useState, useEffect } from '@wordpress/element';
import { BlockControls, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, CheckboxControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import AIImageToolbar from '../components/AIImageToolbar';

/**
 * Enhances the core/image block with an AI image regeneration button.
 *
 * @param {function} BlockEdit - The original BlockEdit component.
 * @returns {function} A new BlockEdit component with additional regeneration functionality.
 */
addFilter('editor.BlockEdit', 'kaigen/add-regenerate-button', (BlockEdit) => {
	return (props) => {
		if (props.name !== 'core/image') {
			return <BlockEdit {...props} />;
		}

		const hasValidId = props.attributes.id && typeof props.attributes.id === 'number' && props.attributes.id > 0;
		const [isRegenerating, setIsRegenerating] = useState(false);
		const [hasInitialized, setHasInitialized] = useState(false);

		// Initialize block attribute from post meta on first load, but only if block attribute is not already set
		useEffect(() => {
			if (!hasValidId || hasInitialized) {
				return;
			}

			// Only initialize if the block attribute is not explicitly set (undefined or null)
			if (props.attributes.kaigen_reference_image === undefined || props.attributes.kaigen_reference_image === null) {
				apiFetch({
					path: `/wp/v2/media/${props.attributes.id}`,
				}).then((media) => {
					if (media && media.meta && typeof media.meta.kaigen_reference_image !== 'undefined') {
						const metaValue = media.meta.kaigen_reference_image === true || media.meta.kaigen_reference_image === 1;
						props.setAttributes({ kaigen_reference_image: metaValue });
					}
					setHasInitialized(true);
				}).catch(() => {
					// Silently fail - default to false
					setHasInitialized(true);
				});
			} else {
				setHasInitialized(true);
			}
		}, [hasValidId, props.attributes.id, props.attributes.kaigen_reference_image, hasInitialized]);

		/**
		 * Build current image object for the modal
		 */
		const currentImage = props.attributes.url ? {
			url: props.attributes.url,
			id: props.attributes.id,
			alt: props.attributes.alt || '',
		} : null;

		/**
		 * Handles the generated image result from the modal.
		 *
		 * @param {Object} result - The generated image data.
		 */
		const handleImageGenerated = (result) => {
			if (result.id && typeof result.id === 'number' && result.id > 0) {
				props.setAttributes({
					url: result.url,
					id: result.id,
				});
			} else {
				props.setAttributes({
					url: result.url,
					id: undefined,
				});
			}

			wp.data.dispatch('core/notices').createSuccessNotice(
				'Image generated successfully!',
				{ type: 'snackbar' }
			);
		};

		return (
			<>
				<BlockEdit {...props} />
				{props.attributes.url && (
					<BlockControls>
						<AIImageToolbar
							isRegenerating={isRegenerating}
							onImageGenerated={handleImageGenerated}
							isImageBlock={true}
							currentImage={currentImage}
						/>
					</BlockControls>
				)}
				{hasValidId && (
					<InspectorControls>
						<PanelBody title="KaiGen Settings" initialOpen={false}>
							<CheckboxControl
								label="Reference image"
								checked={props.attributes.kaigen_reference_image === true}
								onChange={async (newValue) => {
									// Explicitly set to boolean true or false (not undefined)
									const boolValue = newValue === true;
									props.setAttributes({ kaigen_reference_image: boolValue });
									setHasInitialized(true); // Mark as initialized so we don't sync from meta again

									try {
										await apiFetch({
											path: `/wp/v2/media/${props.attributes.id}`,
											method: 'POST',
											data: {
												meta: { kaigen_reference_image: boolValue ? 1 : 0 },
											},
										});
									} catch (err) {
										wp.data.dispatch('core/notices').createErrorNotice(
											'Failed to update reference image meta',
											{ type: 'snackbar' }
										);
									}
								}}
								help="Add to the list of reference images."
							/>
						</PanelBody>
					</InspectorControls>
				)}
			</>
		);
	};
});

// Extend the core/image block to include the new attribute.
addFilter(
	'blocks.registerBlockType',
	'kaigen/add-reference-image-attribute',
	(settings, name) => {
		if (name !== 'core/image') {
			return settings;
		}

		return {
			...settings,
			attributes: {
				...settings.attributes,
				kaigen_reference_image: {
					type: 'boolean',
					default: false,
				},
			},
		};
	}
);
