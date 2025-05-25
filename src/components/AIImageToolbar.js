// This file contains the AIImageToolbar component used in block toolbars for AI image actions.

import { useState } from '@wordpress/element';
import { Spinner, ToolbarButton, ToolbarGroup, Modal, TextareaControl, Button } from '@wordpress/components';

/**
 * AIImageToolbar component for adding AI image generation or regeneration buttons.
 *
 * @param {Object} props - Component properties.
 * @param {boolean} props.isGenerating - Indicates if an image is currently being generated.
 * @param {Function} props.onGenerateImage - Callback to handle image generation.
 * @param {boolean} [props.isRegenerating] - Indicates if an image is being regenerated.
 * @param {Function} [props.onRegenerateImage] - Callback to handle image regeneration.
 * @param {boolean} [props.isImageBlock] - Determines if the current block is an image block.
 * @param {boolean} [props.isTextSelected] - Determines if text is selected to trigger generation.
 * @param {boolean} [props.supportsImageToImage] - Indicates if the current provider supports image-to-image generation.
 * @returns {JSX.Element|null} Returns the toolbar with the appropriate button or null if conditions are unmet.
 */
const AIImageToolbar = ({
    isGenerating,
    onGenerateImage,
    isRegenerating,
    onRegenerateImage,
    isImageBlock,
    isTextSelected,
    supportsImageToImage,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [error, setError] = useState(null);

    const handleRegenerate = () => {
        onRegenerateImage(prompt.trim());
        setIsModalOpen(false);
        setPrompt('');
        setError(null);
    };

    // Render a regenerate button if the current block is an image block.
    if (isImageBlock) {
        return (
            <>
                <ToolbarGroup>
                    <ToolbarButton
                        icon={isRegenerating ? <Spinner /> : "update"}
                        label={isRegenerating ? "KaiGen is generating..." : "KaiGen"}
                        onClick={() => setIsModalOpen(true)}
                        disabled={isRegenerating}
                    />
                </ToolbarGroup>

                {isModalOpen && (
                    <Modal
                        title="KaiGen : Edit Image"
                        onRequestClose={() => {
                            setIsModalOpen(false);
                            setPrompt('');
                            setError(null);
                        }}
                    >
                        {error && <p style={{ color: 'red' }}>{error}</p>}
                        
                        <TextareaControl
                            label="Editing Instructions (optional)"
                            value={prompt}
                            onChange={setPrompt}
                            rows={4}
                        />
                        
                        <Button
                            variant="primary"
                            onClick={handleRegenerate}
                            disabled={isRegenerating}
                        >
                            {isRegenerating ? (
                                <>
                                    <Spinner />
                                    Regenerating...
                                </>
                            ) : (
                                'Regenerate Image'
                            )}
                        </Button>
                    </Modal>
                )}
            </>
        );
    }
    // Render a generate button if text is selected.
    else if (isTextSelected) {
        return (
            <ToolbarGroup>
                <ToolbarButton
                    icon={isGenerating ? <Spinner /> : "format-image"}
                    label={isGenerating ? "KaiGen is generating..." : "KaiGen"}
                    onClick={onGenerateImage}
                    disabled={isGenerating}
                />
            </ToolbarGroup>
        );
    }

    return null;
};

export default AIImageToolbar; 