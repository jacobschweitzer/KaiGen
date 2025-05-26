// This file registers a new rich-text format which uses BlockControls to trigger AI image generation.

import { useEffect, useCallback, useState } from '@wordpress/element'; // Import React hooks.
import { BlockControls } from '@wordpress/block-editor'; // Import BlockControls from the block editor.
import { useSelect, useDispatch } from '@wordpress/data'; // Import necessary data hooks.
import { registerFormatType } from '@wordpress/rich-text'; // Import registerFormatType.
import AIImageToolbar from '../components/AIImageToolbar'; // Import the AIImageToolbar component.
import { generateImage } from '../api'; // Import API function for image generation.

/**
 * Registers the AI Image Generation format type and integrates BlockControls.
 *
 * @returns {void}
 */
registerFormatType('kaigen/custom-format', {
    title: 'AI Image Gen',
    tagName: 'span',
    className: 'kaigen-format',
    edit: ({ isActive, value, onChange }) => { // This edit function adds AI image functionality to the block.
        // Create state for generation state.
        const [isGenerating, setIsGenerating] = useState(false); // Indicates if an image is being generated.

        // Retrieve the currently selected block.
        const selectedBlock = useSelect((select) => select('core/block-editor').getSelectedBlock(), []);
        // Get the dispatch function to replace blocks.
        const { replaceBlocks } = useDispatch('core/block-editor');

        /**
         * Handles the AI image generation process based on the selected text.
         *
         * @returns {void}
         */
        const handleGenerateImage = useCallback(() => { // This function manages image generation.
            if (selectedBlock && selectedBlock.name === 'core/paragraph') {
                // Extract the currently selected text.
                const selectedText = value.text.slice(value.start, value.end).trim();
                if (!selectedText) {
                    // Create an error notice if no text is selected.
                    wp.data.dispatch('core/notices').createErrorNotice(
                        'Please select some text to use as the image generation prompt.',
                        { type: 'snackbar' }
                    );
                    return;
                }

                // Get the provider from editor settings
                const provider = wp.data.select('core/editor')?.getEditorSettings()?.kaigen_provider;
                if (!provider) {
                    wp.data.dispatch('core/notices').createErrorNotice(
                        'No AI provider configured. Please set one in the plugin settings.',
                        { type: 'snackbar' }
                    );
                    return;
                }
                
                // Create a placeholder block to show that image generation is in progress.
                const placeholderBlock = wp.blocks.createBlock('core/heading', {
                    content: 'Generating AI image...',
                    level: 2,
                    style: {
                        textAlign: 'center',
                    },
                });
                // Replace the selected block with the placeholder.
                replaceBlocks(selectedBlock.clientId, [placeholderBlock, selectedBlock]);
                
                setIsGenerating(true); // Set generating state.

                // Call the API function to generate the image.
                generateImage(selectedText, (result) => {
                    setIsGenerating(false); // Reset generating state.
                    
                    if (result.error) {
                        console.error('Image generation failed:', result.error);
                        wp.data.dispatch('core/notices').createErrorNotice(
                            'Failed to generate image: ' + result.error,
                            { type: 'snackbar' }
                        );
                        // Remove the placeholder block on error.
                        replaceBlocks(placeholderBlock.clientId, []);
                    } else {
                        // Create a new image block with the image details
                        let blockAttributes = {
                            url: result.url,
                            alt: result.alt,
                            caption: ''
                        };
                        
                        // Only add ID attribute if it's a valid WordPress media ID
                        if (result.id && typeof result.id === 'number' && result.id > 0) {
                            blockAttributes.id = result.id;
                        }
                        
                        const imageBlock = wp.blocks.createBlock('core/image', blockAttributes);
                        // Replace the placeholder with the new image block.
                        replaceBlocks(placeholderBlock.clientId, [imageBlock]);
                    }
                });
            }
        }, [selectedBlock, value.text, value.start, value.end, replaceBlocks]);

        // Determine if any text is selected.
        const selectedText = value.text.slice(value.start, value.end).trim();
        const isTextSelected = selectedText !== "";

        return (
            <BlockControls>
                <AIImageToolbar
                    isGenerating={isGenerating}
                    onGenerateImage={handleGenerateImage}
                    isTextSelected={isTextSelected}
                />
            </BlockControls>
        );
    },
});
