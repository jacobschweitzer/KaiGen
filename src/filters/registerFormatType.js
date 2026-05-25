// This file registers a new rich-text format which uses BlockControls to trigger AI image generation.

import { useCallback, useState } from '@wordpress/element'; // Import React hooks.
import { BlockControls } from '@wordpress/block-editor'; // Import BlockControls from the block editor.
import { createBlock } from '@wordpress/blocks'; // Import block factory.
import { useSelect, useDispatch } from '@wordpress/data'; // Import necessary data hooks.
import { registerFormatType } from '@wordpress/rich-text'; // Import registerFormatType.
import AIImageToolbar from '../components/AIImageToolbar'; // Import the AIImageToolbar component.
import { generateImage } from '../api'; // Import API function for image generation.

/**
 * Internal component that handles AI image generation for the format type.
 *
 * @param {Object} props       - Component props.
 * @param {Object} props.value - Rich text value object.
 * @return {JSX.Element} The BlockControls with AIImageToolbar.
 */
const FormatEditComponent = ( { value } ) => {
	// Create state for generation state.
	const [ isGenerating, setIsGenerating ] = useState( false ); // Indicates if an image is being generated.

	// Retrieve the currently selected block.
	const selectedBlock = useSelect(
		( select ) => select( 'core/block-editor' ).getSelectedBlock(),
		[]
	);
	// Get the dispatch function to replace blocks.
	const { replaceBlocks } = useDispatch( 'core/block-editor' );

	/**
	 * Handles the AI image generation process based on the selected text.
	 *
	 * @return {void}
	 */
	const handleGenerateImage = useCallback( async () => {
		// This function manages image generation.
		if ( selectedBlock && selectedBlock.name === 'core/paragraph' ) {
			// Extract the currently selected text.
			const selectedText = value.text
				.slice( value.start, value.end )
				.trim();
			if ( ! selectedText ) {
				// Create an error notice if no text is selected.
				wp.data
					.dispatch( 'core/notices' )
					.createErrorNotice(
						'Please select some text to use as the image generation prompt.',
						{ type: 'snackbar' }
					);
				return;
			}

			// Create a placeholder block to show that image generation is in progress.
			const placeholderBlock = createBlock( 'core/heading', {
				content: 'Generating AI image...',
				level: 2,
				className: 'kaigen-text-center',
			} );
			// Replace the selected block with the placeholder.
			replaceBlocks( selectedBlock.clientId, [
				placeholderBlock,
				selectedBlock,
			] );

			setIsGenerating( true ); // Set generating state.

			try {
				const result = await generateImage( selectedText );
				const blockAttributes = {
					url: result.url,
					alt: result.alt,
					caption: '',
				};

				if (
					result.id &&
					typeof result.id === 'number' &&
					result.id > 0
				) {
					blockAttributes.id = result.id;
				}

				const imageBlock = createBlock( 'core/image', blockAttributes );
				replaceBlocks( placeholderBlock.clientId, [ imageBlock ] );
			} catch ( error ) {
				wp.data
					.dispatch( 'core/notices' )
					.createErrorNotice(
						'Failed to generate image: ' +
							( error.message ||
								'An unknown error occurred while generating the image' ),
						{ type: 'snackbar' }
					);
				replaceBlocks( placeholderBlock.clientId, [] );
			} finally {
				setIsGenerating( false );
			}
		}
	}, [ selectedBlock, value.text, value.start, value.end, replaceBlocks ] );

	// Determine if any text is selected.
	const selectedText = value.text.slice( value.start, value.end ).trim();
	const isTextSelected = selectedText !== '';

	return (
		<BlockControls>
			<AIImageToolbar
				isGenerating={ isGenerating }
				onGenerateImage={ handleGenerateImage }
				isTextSelected={ isTextSelected }
			/>
		</BlockControls>
	);
};

/**
 * Registers the AI Image Generation format type and integrates BlockControls.
 *
 * @return {void}
 */
registerFormatType( 'kaigen/custom-format', {
	title: 'AI Image Gen',
	tagName: 'span',
	className: 'kaigen-format',
	edit: ( { value } ) => {
		return <FormatEditComponent value={ value } />;
	},
} );
