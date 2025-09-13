// This file enhances the MediaUpload component by adding the AITab for AI image generation.

import { addFilter } from '@wordpress/hooks'; // Import the addFilter function.
import AITab from '../components/AITab'; // Import the AITab component.

/**
 * Enhances the MediaUpload component by adding the AITab.
 *
 * @param {Object} props - Properties passed to the MediaUpload component.
 * @returns {JSX.Element} The enhanced MediaUpload component with the AITab.
 */
addFilter('editor.MediaUpload', 'kaigen/add-ai-tab', (OriginalMediaUpload) => {
    // Return a new component which wraps the original MediaUpload.
    return (props) => {
        // Check if the MediaUpload is used for a single image block.
        const isSingleImageBlock = props.allowedTypes && props.allowedTypes.includes('image') && !props.multiple;

        // Retrieve the currently selected block from the editor.
        const selectedBlock = wp.data.select('core/block-editor').getSelectedBlock();

        // Determine if the block is an image block.
        const isImageBlock = selectedBlock && selectedBlock.name === 'core/image';

        /**
         * Checks if the current block already has image data.
         *
         * @returns {boolean} True if the block has an image, otherwise false.
         */
        const hasImageData = () => {
            return selectedBlock && selectedBlock.attributes && selectedBlock.attributes.url;
        };

        const hasApiKey = wp.data.select('core/editor')?.getEditorSettings()?.kaigen_has_api_key;

        // Only display AITab if this is a single image block without image data.
        const shouldDisplay = isSingleImageBlock && isImageBlock && !hasImageData() && hasApiKey;

        return (
            <OriginalMediaUpload
                {...props}
                render={(originalProps) => (
                    <>
                        {/* Render the default MediaUpload component. */}
                        {props.render(originalProps)}
                        {/* Add the AITab component if conditions are met. */}
                        <AITab 
                            onSelect={props.onSelect}
                            shouldDisplay={shouldDisplay}
                        />
                    </>
                )}
            />
        );
    };
});
