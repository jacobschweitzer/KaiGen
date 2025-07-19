// This file contains the AIImageToolbar component used in block toolbars for AI image actions.

import { useState } from '@wordpress/element';
import { Spinner, ToolbarButton, ToolbarGroup, Modal, TextareaControl, Button, CheckboxControl } from '@wordpress/components';
import kaiGenLogo from '../../assets/KaiGen-logo-128x128.png';

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
    const [inputFidelity, setInputFidelity] = useState('low');

    const handleRegenerate = () => {
        onRegenerateImage(prompt.trim(), inputFidelity);
        setIsModalOpen(false);
        setPrompt('');
        setError(null);
        setInputFidelity('low');
    };

    // Render a regenerate button if the current block is an image block and provider supports image-to-image.
    if (isImageBlock && supportsImageToImage) {
        return (
            <>
                <ToolbarGroup>
                    <ToolbarButton
                        icon={isRegenerating ? <Spinner /> : <img src={kaiGenLogo} alt="KaiGen logo" style={{ height: '20px', width: '20px' }} />}
                        label={isRegenerating ? "KaiGen is generating..." : "KaiGen"}
                        onClick={() => setIsModalOpen(true)}
                        disabled={isRegenerating}
                    />
                </ToolbarGroup>

                {isModalOpen && (
                    <Modal
                        title={
                            <img
                                src={kaiGenLogo}
                                alt="KaiGen logo"
                                style={{ height: '80px', width: 'auto', display: 'block' }}
                            />
                        }
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
                        
                        {window.kaiGen?.provider === 'openai' && (
                            <CheckboxControl
                                label="High Fidelity"
                                checked={inputFidelity === 'high'}
                                onChange={(isChecked) => setInputFidelity(isChecked ? 'high' : 'low')}
                                help="Control how much effort the model will exert to match the style and features of input images."
                            />
                        )}

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