// This file contains the AITab React component used to generate AI images through a modal.

import { useState, useEffect } from '@wordpress/element'; // Import WordPress hooks.
import { Button, TextareaControl, Modal, Spinner, Dropdown, Dashicon } from '@wordpress/components'; // Import necessary UI components.
import { generateImage, fetchReferenceImages } from '../api'; // Import API functions.

const kaiGenLogoBig = window.kaiGen?.logoUrl;

/**
 * AITab component for generating AI images.
 *
 * @param {Object} props - The properties object.
 * @param {function} props.onSelect - The callback function to handle the selected image.
 * @param {boolean} props.shouldDisplay - Flag indicating whether to render the AITab.
 * @returns {JSX.Element|null} The rendered AITab component or null if not displayed.
 */
const AITab = ({ onSelect, shouldDisplay }) => { // This is the AITab functional component.
    // State for modal visibility, prompt text, loading indicator, and error message.
    const [isModalOpen, setIsModalOpen] = useState(false); // Indicates if the modal is open.
    const [prompt, setPrompt] = useState(''); // Stores the image prompt.
    const [isLoading, setIsLoading] = useState(false); // Indicates if image generation is in progress.
    const [error, setError] = useState(null); // Holds any error messages.
    const [referenceImages, setReferenceImages] = useState([]);
    const [selectedRefs, setSelectedRefs] = useState([]);
    const [aspectRatio, setAspectRatio] = useState('1:1');

    const supportsImageToImage = window.kaiGen?.supportsImageToImage || false;
    const provider = wp.data.select('core/editor')?.getEditorSettings()?.kaigen_provider || 'replicate';
    const maxRefs = provider === 'replicate' ? 10 : 16;

    useEffect(() => {
        if (isModalOpen && supportsImageToImage) {
            fetchReferenceImages().then(setReferenceImages);
        }
    }, [isModalOpen]);

    /**
     * Handles Enter key press in textarea
     *
     * @param {KeyboardEvent} e - The keyboard event
     * @returns {void}
     */
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    };

    /**
     * Handles the image generation process when the Generate button is clicked.
     *
     * @returns {void}
     */
    const handleGenerate = () => { // This function handles the generation of an AI image.
        // Check if the prompt is empty or consists solely of whitespace.
        if (!prompt.trim()) {
            setError('Please enter a prompt for image generation.');
            return;
        }
        setIsLoading(true); // Start loading state.
        setError(null); // Clear any previous errors.

        const options = {};
        if (selectedRefs.length > 0) {
            options.sourceImageUrls = selectedRefs.map(ref => ref.url);
        }
        if (aspectRatio) {
            options.aspectRatio = aspectRatio;
        }

        // Call generateImage API function with the prompt
        generateImage(prompt.trim(), (media) => {
            if (media.error) {
                setError(media.error); // Set error if generation fails.
                setIsLoading(false); // End loading state.
            } else {
                onSelect(media); // Pass image media back to the parent.
                setIsLoading(false); // End loading state.
                setIsModalOpen(false); // Close the modal.
            }
        }, options);
    };

    // Do not render the component if shouldDisplay is false.
    if (!shouldDisplay) {
        return null;
    }

    return (
        <>
            {/* KaiGen button for placeholder context (shown in editor canvas) */}
            <Button
                onClick={() => setIsModalOpen(true)}
                className="kaigen-placeholder-button"
                aria-label="KaiGen"
            >
                <img
                    src={kaiGenLogoBig}
                    alt="KaiGen"
                    style={{ width: '48px', height: '48px' }}
                />
            </Button>

            {/* KaiGen button for dropdown/popover context (styled as menu item) */}
            <button
                type="button"
                role="menuitem"
                onClick={() => setIsModalOpen(true)}
                className="components-button components-menu-item__button is-next-40px-default-size kaigen-menu-item-button"
            >
                <span className="components-menu-item__item">KaiGen</span>
                <img
                    src={kaiGenLogoBig}
                    alt=""
                    aria-hidden="true"
                    className="components-menu-items__item-icon has-icon-right"
                    style={{ width: '24px', height: '24px' }}
                />
            </button>

            {/* Modal for entering the prompt and generating the image. */}
            {isModalOpen && (
                <Modal
                    className="kaigen-modal"
                    title={
                        <div className="kaigen-modal__logo-container">
                            <img
                                src={kaiGenLogoBig}
                                alt="KaiGen logo"
                                className="kaigen-modal__logo"
                            />
                        </div>
                    }
                    aria-label="KaiGen"
                    onRequestClose={() => setIsModalOpen(false)}
                >
                    {/* Display error message if present. */}
                    {error && <p className="kaigen-error-text">{error}</p>}
                    
                    {/* Horizontal layout container */}
                    <div className="kaigen-modal__input-container">
                        
                        {/* Left: Reference Images Button */}
                        {supportsImageToImage && (
                            <Dropdown
                                onFocusOutside={() => setIsOpen(false)}
                                popoverProps={{ placement: 'bottom-start', focusOnMount: true }}
                                renderToggle={({ isOpen, onToggle }) => (
                                    <Button
                                        className={`kaigen-modal__ref-button ${selectedRefs.length > 0 ? 'kaigen-ref-button-selected' : ''}`}
                                        onClick={onToggle}
                                        aria-expanded={isOpen}
                                        aria-label="Reference Images"
                                    >
                                        <Dashicon 
                                            icon="format-image" 
                                            className={selectedRefs.length > 0 ? 'kaigen-ref-button-icon-selected' : ''}
                                        />
                                    </Button>
                                )}
                                renderContent={() => (
                                    <div className="kaigen-modal-dropdown-content-container">
                                        <h4 className="kaigen-modal-dropdown-content-title">Reference Images (up to {maxRefs})</h4>
                                        {referenceImages.length > 0 ? (
                                            <div className="kaigen-modal-reference-images-container">
                                                {referenceImages.map((img) => (
                                                    <img
                                                        key={img.id}
                                                        src={img.url}
                                                        alt={img.alt || ''}
                                                        onClick={() => {
                                                            setSelectedRefs(prev => {
                                                                if (prev.some(s => s.id === img.id)) {
                                                                    return prev.filter(s => s.id !== img.id);
                                                                } else if (prev.length < maxRefs) {
                                                                    return [...prev, img];
                                                                }
                                                                return prev;
                                                            });
                                                        }}
                                                        className={`kaigen-modal-reference-image ${selectedRefs.some(s => s.id === img.id) ? 'kaigen-modal-reference-image-selected' : ''}`}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="kaigen-modal-no-references">No reference images. Mark images in the Media Library to use them here.</p>
                                        )}
                                    </div>
                                )}
                            />
                        )}
                        
                        {/* Center: Prompt Textarea */}
                        <div className="kaigen-modal__textarea-container">
                            <TextareaControl
                                className="kaigen-modal__textarea"
                                placeholder="Image prompt..."
                                value={prompt}
                                onChange={setPrompt}
                                onKeyDown={handleKeyPress}
                                rows={2}
                                autoFocus
                            />
                        </div>
                        
                        {/* Submit button - only shown when there's a prompt */}
                        {prompt.trim() && (
                            <Button
                                className="kaigen-modal__submit-button"
                                variant="primary"
                                onClick={handleGenerate}
                                disabled={isLoading || !prompt.trim()}
                                aria-label="Generate Image"
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner />
                                    </>
                                ) : (
                                    <Dashicon icon="admin-appearance" />
                                )}
                            </Button>
                        )}

                        {/* Right: Settings Button */}
                        <Dropdown
                            onFocusOutside={() => setIsOpen(false)}
                            popoverProps={{ placement: 'bottom-end', focusOnMount: true }}
                            renderToggle={({ isOpen, onToggle }) => (
                                <Button
                                    className="kaigen-modal__settings-button"
                                    onClick={onToggle}
                                    aria-expanded={isOpen}
                                    aria-label="Settings"
                                >
                                    <Dashicon icon="admin-generic" />
                                </Button>
                            )}
                            renderContent={() => (
                                <div className="kaigen-modal-dropdown-content-container">
                                    <h4 className="kaigen-modal-dropdown-content-title">Aspect Ratio</h4>
                                    <div className="kaigen-modal-aspect-ratio-container">
                                        {[
                                            { value: '1:1', label: '1:1', title: 'Square' },
                                            { value: '16:9', label: '16:9', title: 'Landscape' },
                                            { value: '9:16', label: '9:16', title: 'Portrait' },
                                        ].map((opt) => (
                                            <div
                                                key={opt.value}
                                                onClick={() => setAspectRatio((prev) => (prev === opt.value ? null : opt.value))}
                                                aria-pressed={aspectRatio === opt.value}
                                                aria-label={`${opt.title} (${opt.label})`}
                                                className={`kaigen-modal__aspect-ratio-button ${aspectRatio === opt.value ? 'kaigen-modal__aspect-ratio-button-selected' : ''}`}>
                                                <div
                                                    className="kaigen-modal-aspect-ratio-icon-container"
                                                >
                                                    <div
                                                        className={`kaigen-modal-aspect-ratio-icon ${aspectRatio === opt.value ? 'kaigen-modal-aspect-ratio-icon-selected' : ''} kaigen-aspect-ratio-${opt.value.replace(':', '-')}`}>
                                                    </div>
                                                </div>
                                                <span className="kaigen-modal-aspect-ratio-label">{opt.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        />
                    </div>

                </Modal>
            )}
        </>
    );
};

export default AITab; // Export the AITab component. 