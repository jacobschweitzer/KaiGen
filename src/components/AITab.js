// This file contains the AITab React component used to generate AI images through a modal.

import { useState, useEffect } from '@wordpress/element'; // Import WordPress hooks.
import { Button, TextareaControl, Modal, Spinner, SelectControl } from '@wordpress/components'; // Import necessary UI components.
import { generateImage, fetchProviders } from '../api'; // Import API functions.

/**
 * AITab component for generating AI images.
 *
 * @param {Object} props - The properties object.
 * @param {function} props.onSelect - The callback function to handle the selected image.
 * @param {boolean} props.shouldDisplay - Flag indicating whether to render the AITab.
 * @returns {JSX.Element|null} The rendered AITab component or null if not displayed.
 */
const AITab = ({ onSelect, shouldDisplay }) => { // This is the AITab functional component.
    // State for modal visibility, prompt text, loading indicator, available providers, selected provider, and error message.
    const [isModalOpen, setIsModalOpen] = useState(false); // Indicates if the modal is open.
    const [prompt, setPrompt] = useState(''); // Stores the image prompt.
    const [isLoading, setIsLoading] = useState(false); // Indicates if image generation is in progress.
    const [providers, setProviders] = useState([]); // Holds available provider IDs.
    const [selectedProvider, setSelectedProvider] = useState(''); // Tracks the selected provider.
    const [error, setError] = useState(null); // Holds any error messages.

    // Fetch providers from the server when the component mounts.
    useEffect(() => {
        const initializeProviders = async () => { // This async function fetches providers.
            try {
                const result = await fetchProviders(); // Call the API to get providers.
                if (result.error) {
                    setError(result.error); // Set error state if fetching failed.
                    return;
                }
                setProviders(result); // Set the list of providers.

                // Retrieve the last used provider from localStorage.
                const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
                // Use the stored provider if valid, otherwise choose the first available provider.
                if (storedProvider && result.includes(storedProvider)) {
                    setSelectedProvider(storedProvider);
                } else if (result.length > 0) {
                    setSelectedProvider(result[0]);
                    localStorage.setItem('wpAiImageGenLastProvider', result[0]); // Save the default provider.
                }
            } catch (err) {
                setError('Failed to fetch providers: ' + err.message); // Set error if provider fetching fails.
            }
        };

        initializeProviders(); // Invoke our initializeProviders function.
    }, []);

    // Update localStorage whenever the selected provider changes.
    useEffect(() => {
        if (selectedProvider) {
            localStorage.setItem('wpAiImageGenLastProvider', selectedProvider); // Save the selected provider.
        }
    }, [selectedProvider]);

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
        // Ensure a provider is selected.
        if (!selectedProvider) {
            setError('Please select a provider for image generation.');
            return;
        }
        setIsLoading(true); // Start loading state.
        setError(null); // Clear any previous errors.

        // Call generateImage API function with the prompt and selected provider.
        generateImage(prompt.trim(), selectedProvider, (media) => {
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

    // Map provider IDs to objects for the SelectControl dropdown.
    const providerOptions = providers.map((id) => ({ 
        value: id, 
        label: id.charAt(0).toUpperCase() + id.slice(1), // Capitalize the first letter.
    }));

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
                    Generate AI Image
                </Button>
            </div>

            {/* Modal for entering the prompt and generating the image. */}
            {isModalOpen && (
                <Modal
                    title="WP AI Image Gen" // Modal title.
                    onRequestClose={() => setIsModalOpen(false)} // Closes the modal.
                >
                    {/* Display error message if present. */}
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    
                    {/* Render the provider dropdown only if there is more than one provider. */}
                    {providerOptions.length > 1 && (
                        <SelectControl
                            label="Select Provider"
                            value={selectedProvider}
                            options={providerOptions}
                            onChange={setSelectedProvider} // Updates selected provider.
                        />
                    )}
                    
                    {/* Textarea to enter the image prompt. */}
                    <TextareaControl
                        label="Enter your image prompt"
                        value={prompt}
                        onChange={setPrompt} // Updates the prompt state.
                        rows={4}
                    />
                    
                    {/* Button to trigger image generation. */}
                    <Button
                        variant="primary" // Uses primary styling.
                        onClick={handleGenerate} // Initiates image generation.
                        disabled={isLoading || !selectedProvider || !prompt.trim()} // Disables button if conditions are not met.
                    >
                        {isLoading ? (
                            <>
                                <Spinner /> {/* Display spinner during loading. */}
                                Generating...
                            </>
                        ) : (
                            'Generate Image'
                        )}
                    </Button>
                </Modal>
            )}
        </>
    );
};

export default AITab; // Export the AITab component. 