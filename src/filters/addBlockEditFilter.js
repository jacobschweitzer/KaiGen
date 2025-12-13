// This file modifies the block editor for core/image blocks to include an AI image regeneration button.

import { addFilter } from '@wordpress/hooks';
import { useState, useEffect, useCallback } from '@wordpress/element';
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

		/**
		 * Marks the current image as a reference image if it has a valid ID.
		 */
		const markAsReferenceImage = useCallback(async () => {
			if (!hasValidId || props.attributes.kaigen_reference_image) {
				return;
			}

			props.setAttributes({ kaigen_reference_image: true });

			try {
				await apiFetch({
					path: `/wp/v2/media/${props.attributes.id}`,
					method: 'POST',
					data: {
						meta: { kaigen_reference_image: 1 },
					},
				});
			} catch (err) {
				// Silently fail - the image can still be used as reference via URL
				console.warn('Failed to mark image as reference:', err);
			}
		}, [hasValidId, props.attributes.id, props.attributes.kaigen_reference_image]);

		// Mark image as reference when it has a valid ID and URL
		useEffect(() => {
			if (hasValidId && props.attributes.url && !props.attributes.kaigen_reference_image) {
				markAsReferenceImage();
			}
		}, [hasValidId, props.attributes.url, props.attributes.kaigen_reference_image, markAsReferenceImage]);

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
								checked={props.attributes.kaigen_reference_image || false}
								onChange={async (newValue) => {
									props.setAttributes({ kaigen_reference_image: newValue });

									try {
										await apiFetch({
											path: `/wp/v2/media/${props.attributes.id}`,
											method: 'POST',
											data: {
												meta: { kaigen_reference_image: newValue ? 1 : 0 },
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
