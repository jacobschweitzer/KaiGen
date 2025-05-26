// This file contains the AITab React component used to generate AI images through a modal.

import { useState } from '@wordpress/element'; // Import WordPress hooks.
import { Button, TextareaControl, Modal, Spinner } from '@wordpress/components'; // Import necessary UI components.
import { generateImage } from '../api'; // Import API functions.

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
        });
    };

    // Do not render the component if shouldDisplay is false.
    if (!shouldDisplay) {
        return null;
    }

    return (
        <>
            {/* Button to open the AI image generation modal */}
            <div className="block-editor-media-placeholder__url-input-container">
                <Button
                    variant="secondary"
                    onClick={() => setIsModalOpen(true)}
                    className="components-button is-next-40px-default-size is-secondary"
                >
                    KaiGen
                </Button>
            </div>

            {/* Modal for entering the prompt and generating the image. */}
            {isModalOpen && (
                <Modal
                    title="KaiGen" // Modal title.
                    onRequestClose={() => setIsModalOpen(false)} // Closes the modal.
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