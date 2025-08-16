// This file contains the AITab React component used to generate AI images through a modal.

import { useState, useEffect } from '@wordpress/element'; // Import WordPress hooks.
import { Button, TextareaControl, Modal, Spinner } from '@wordpress/components'; // Import necessary UI components.
import kaiGenLogo from '../../assets/KaiGen-logo-128x128.png'; // Import KaiGen logo
import { generateImage, fetchReferenceImages } from '../api'; // Import API functions.

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
    const [selectedRef, setSelectedRef] = useState(null);
    const [aspectRatio, setAspectRatio] = useState('1:1');

    const supportsImageToImage = window.kaiGen?.supportsImageToImage || false;

    useEffect(() => {
        if (isModalOpen && supportsImageToImage) {
            fetchReferenceImages().then(setReferenceImages);
        }
    }, [isModalOpen]);

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
        if (selectedRef) {
            options.sourceImageUrl = selectedRef.url;
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
            {/* KaiGen button – rendered inside the main placeholder buttons container */}
            <Button
                onClick={() => setIsModalOpen(true)}
                className="kaigen-placeholder-button"
                style={{
                    order: 99,
                    padding: 0,
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    minWidth: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                aria-label="KaiGen"
                role="button"
                title="KaiGen"
            >
                <img
                    src={kaiGenLogo}
                    alt="KaiGen"
                    style={{ height: '40px', width: '40px', objectFit: 'contain', border: 'none', background: 'transparent' }}
                    aria-label="KaiGen logo"
                    role="button"
                    title="KaiGen logo"
                />
            </Button>

            {/* Modal for entering the prompt and generating the image. */}
            {isModalOpen && (
                <Modal
                    title={
                        <img
                            src={kaiGenLogo}
                            alt="KaiGen logo"
                            style={{ height: '80px', width: 'auto', display: 'block' }}
                        />
                    }
                    aria-label="KaiGen"
                    onRequestClose={() => setIsModalOpen(false)}
                >
                    {/* Display error message if present. */}
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    
                    {/* Textarea to enter the image prompt. */}
                    <TextareaControl
                        label="Prompt"
                        value={prompt}
                        onChange={setPrompt} // Updates the prompt state.
                        rows={4}
                    />

                    {/* Aspect ratio selector */}
                    <div style={{ margin: '8px 0 12px 0' }}>
                        <h4 style={{ margin: '0 0 6px 0' }}>Aspect Ratio</h4>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {[
                                { value: '1:1', label: '1:1', title: 'Square' },
                                { value: '16:9', label: '16:9', title: 'Landscape' },
                                { value: '9:16', label: '9:16', title: 'Portrait' },
                            ].map((opt) => (
                                <Button
                                    key={opt.value}
                                    onClick={() => setAspectRatio((prev) => (prev === opt.value ? null : opt.value))}
                                    onMouseDown={(e) => e.preventDefault()}
                                    style={{
                                        border: aspectRatio === opt.value ? '2px solid #007cba' : '1px solid #ccd0d4',
                                        background: '#fff',
                                        padding: 0,
                                        width: '75px',
                                        height: '75px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        outline: 'none',
                                        boxShadow: 'none',
                                    }}
                                    aria-pressed={aspectRatio === opt.value}
                                    aria-label={`${opt.title} (${opt.label})`}
                                    title={`${opt.title} (${opt.label})`}
                                >
                                    <div
                                        style={{
                                            width: '50px',
                                            height: '36px',
                                            background: 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {(() => {
                                            const containerW = 50;
                                            const containerH = 36;
                                            const margin = 10; // keep inner preview comfortably inside
                                            const maxW = containerW - margin;
                                            const maxH = containerH - margin;
                                            const [wRatio, hRatio] = opt.value.split(':').map(Number);
                                            let w = maxW;
                                            let h = (maxW * hRatio) / wRatio;
                                            if (h > maxH) {
                                                h = maxH;
                                                w = (maxH * wRatio) / hRatio;
                                            }
                                            return (
                                                <div
                                                    style={{
                                                        width: `${Math.round(w)}px`,
                                                        height: `${Math.round(h)}px`,
                                                        background: '#e9eef0',
                                                        border: '1px solid #c3c4c7',
                                                    }}
                                                />
                                            );
                                        })()}
                                    </div>
                                    <span style={{ fontSize: '12px', color: '#1e1e1e' }}>{opt.label}</span>
                                </Button>
                            ))}
                        </div>
                    </div>

                    {supportsImageToImage && referenceImages.length > 0 && (
                        <>
                            <div style={{ width: '250px', marginBottom: '8px' }}>
                                <h4 style={{ margin: '0 0 4px 0' }}>Reference Images</h4>
                                <div
                                    style={{
                                        display: 'flex',
                                        overflowX: 'auto',
                                        overflowY: 'hidden',
                                        gap: '4px',
                                        WebkitOverflowScrolling: 'touch',
                                    }}
                                >
                                    {referenceImages.map((img) => (
                                        <img
                                            key={img.id}
                                            src={img.url}
                                            alt={img.alt || ''}
                                            onClick={() => (selectedRef && selectedRef.id === img.id) ? setSelectedRef(null) : setSelectedRef(img)}
                                            style={{
                                                width: '80px',
                                                height: '80px',
                                                objectFit: 'contain',
                                                cursor: 'pointer',
                                                flex: '0 0 auto',
                                                border: selectedRef && selectedRef.id === img.id ? '4px solid #007cba' : '4px solid transparent',
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                    
                    {/* Button to trigger image generation. */}
                    <Button
                        variant="primary" // Uses primary styling.
                        onClick={handleGenerate} // Initiates image generation.
                        disabled={isLoading || !prompt.trim()} // Disables button if conditions are not met.
                    >
                        {isLoading ? (
                            <>
                                <Spinner /> {/* Display spinner during loading. */}
                                KaiGen is generating...
                            </>
                        ) : (
                            'KaiGen'
                        )}
                    </Button>
                </Modal>
            )}
        </>
    );
};

export default AITab; // Export the AITab component. 