// This file modifies the block editor for core/image blocks to include an AI image regeneration button.

import { addFilter } from '@wordpress/hooks'; // Import the addFilter function.
import { useState, useEffect } from '@wordpress/element'; // Import necessary React hooks.
import { BlockControls, InspectorControls } from '@wordpress/block-editor'; // Import Block & Inspector controls.
import { PanelBody, CheckboxControl } from '@wordpress/components'; // Import components for sidebar UI.
import apiFetch from '@wordpress/api-fetch'; // Import apiFetch for REST requests.
import AIImageToolbar from '../components/AIImageToolbar'; // Import the AIImageToolbar component.
import { generateImage } from '../api'; // Import API functions for image generation.

/**
 * Enhances the core/image block with an AI image regeneration button.
 *
 * @param {function} BlockEdit - The original BlockEdit component.
 * @returns {function} A new BlockEdit component with additional regeneration functionality.
 */
addFilter('editor.BlockEdit', 'kaigen/add-regenerate-button', (BlockEdit) => {
    // Return a new functional component that wraps the original BlockEdit.
    return (props) => {
        // Only modify core/image blocks.
        if (props.name !== 'core/image') {
            return <BlockEdit {...props} />;
        }

        // Determine if the image has a valid WordPress attachment ID
        const hasValidId = props.attributes.id && typeof props.attributes.id === 'number' && props.attributes.id > 0;

        // State to manage regeneration progress and errors.
        const [isRegenerating, setIsRegenerating] = useState(false); // Indicates if regeneration is in progress.
        const [error, setError] = useState(null); // Holds error messages if any.
        const [supportsImageToImage, setSupportsImageToImage] = useState(false); // Whether provider supports image-to-image

        // Initialize the provider from settings on component mount.
        useEffect(() => {
            const initializeProvider = async () => {
                try {
                    // Get the provider and image-to-image support from localized data
                    const provider = window.kaiGen?.provider;
                    const supportsImageToImage = window.kaiGen?.supportsImageToImage || false;

                    if (!provider) {
                        return;
                    }

                    // Set image-to-image support based on localized data
                    setSupportsImageToImage(supportsImageToImage);
                } catch (err) {
                    console.error('Failed to initialize provider:', err);
                }
            };

            // Start initialization immediately
            initializeProvider();
        }, []);

        /**
         * Handles the AI image regeneration process for the current image block.
         *
         * @param {string} prompt - The prompt for image modification.
         * @returns {Promise<void>} A promise that resolves when regeneration is complete.
         */
        const handleRegenerateImage = async (prompt) => {
            setError(null); // Clear any previous errors.

            // Use alt text as fallback if no prompt is provided
            const finalPrompt = prompt || props.attributes.alt || "no alt text or prompt, please just enhance";

            // Get the provider from localized data
            const provider = window.kaiGen?.provider;

            if (!provider) {
                wp.data.dispatch('core/notices').createErrorNotice(
                    'No AI provider configured. Please check your plugin settings.',
                    { type: 'snackbar' }
                );
                return;
            }

            setIsRegenerating(true); // Indicate that regeneration is starting.

            try {
                // Get the source image URL if available
                const sourceImageUrl = props.attributes.url;
                
                // Set up options for image generation
                const options = {};
                if (supportsImageToImage && sourceImageUrl) {
                    options.sourceImageUrl = sourceImageUrl;
                } else if (supportsImageToImage && !sourceImageUrl) {
                    wp.data.dispatch('core/notices').createWarningNotice(
                        'Image-to-image generation requires a source image. Please ensure the image is properly loaded.',
                        { type: 'snackbar' }
                    );
                }
                
                // Wrap the generateImage call in a promise.
                const result = await new Promise((resolve, reject) => {
                    generateImage(finalPrompt, (result) => {
                        if (result.error) {
                            reject(new Error(result.error));
                        } else {
                            resolve(result);
                        }
                    }, options);
                });

                // Update the block attributes with the new image data.
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
                    'Image regenerated successfully!',
                    { type: 'snackbar' }
                );
            } catch (err) {
                let errorMessage = err.message || 'Unknown error';
                let actionGuidance = '';
                
                if (errorMessage.includes('organization verification')) {
                    actionGuidance = ' Please verify your organization in the OpenAI dashboard.';
                } else if (errorMessage.includes('parameter')) {
                    errorMessage = 'API configuration error. Please contact the plugin developer.';
                } else if (errorMessage.includes('content policy')) {
                    actionGuidance = ' Try a different prompt.';
                }
                
                wp.data.dispatch('core/notices').createErrorNotice(
                    'Failed to regenerate image: ' + errorMessage + actionGuidance,
                    { type: 'snackbar' }
                );
            } finally {
                setIsRegenerating(false);
            }
        };

        return (
            <>
                <BlockEdit {...props} />
                {/* Only show toolbar when image block has an actual image */}
                {props.attributes.url && (
                    <BlockControls>
                        <AIImageToolbar
                            isRegenerating={isRegenerating}
                            onRegenerateImage={handleRegenerateImage}
                            isImageBlock={true}
                            supportsImageToImage={supportsImageToImage}
                        />
                    </BlockControls>
                )}
                {/* Sidebar controls, only show when attachment has a valid ID */}
                {hasValidId && (
                    <InspectorControls>
                        <PanelBody title="KaiGen Settings" initialOpen={false}>
                            <CheckboxControl
                                label="Reference image"
                                checked={props.attributes.kaigen_reference_image || false}
                                onChange={async (newValue) => {
                                    // Update block attribute for UI state
                                    props.setAttributes({ kaigen_reference_image: newValue });

                                    // Update attachment meta via REST API
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

        // Inject the attribute if it doesn't already exist.
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
