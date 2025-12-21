// This file contains the AIImageToolbar component used in block toolbars for AI image actions.

import { useState } from '@wordpress/element';
import { Spinner, ToolbarButton, ToolbarGroup } from '@wordpress/components';
import GenerateImageModal from './GenerateImageModal';

const kaiGenLogo = window.kaiGen?.logoUrl;

/**
 * AIImageToolbar component for adding AI image generation or regeneration buttons.
 *
 * @param {Object}   props                    - Component properties.
 * @param {boolean}  props.isGenerating       - Indicates if an image is currently being generated.
 * @param {Function} props.onGenerateImage    - Callback to handle image generation.
 * @param {boolean}  [props.isRegenerating]   - Indicates if an image is being regenerated.
 * @param {Function} [props.onImageGenerated] - Callback when image is generated (for regenerate).
 * @param {boolean}  [props.isImageBlock]     - Determines if the current block is an image block.
 * @param {boolean}  [props.isTextSelected]   - Determines if text is selected to trigger generation.
 * @param {Object}   [props.currentImage]     - The current image data for regeneration (url, id, alt).
 * @return {JSX.Element|null} Returns the toolbar with the appropriate button or null if conditions are unmet.
 */
const AIImageToolbar = ( {
	isGenerating,
	onGenerateImage,
	isRegenerating,
	onImageGenerated,
	isImageBlock,
	isTextSelected,
	currentImage,
} ) => {
	const [ isModalOpen, setIsModalOpen ] = useState( false );

	// Render a regenerate button if the current block is an image block.
	if ( isImageBlock ) {
		return (
			<>
				<ToolbarGroup>
					<ToolbarButton
						icon={
							isRegenerating ? (
								<Spinner />
							) : (
								<img
									src={ kaiGenLogo }
									alt="KaiGen logo"
									className="kaigen-toolbar-icon"
								/>
							)
						}
						label={
							isRegenerating
								? 'KaiGen is generating...'
								: 'KaiGen'
						}
						onClick={ () => setIsModalOpen( true ) }
						disabled={ isRegenerating }
					/>
				</ToolbarGroup>

				<GenerateImageModal
					isOpen={ isModalOpen }
					onClose={ () => setIsModalOpen( false ) }
					onSelect={ onImageGenerated }
					initialReferenceImage={ currentImage }
				/>
			</>
		);
	}
	// Render a generate button if text is selected.
	else if ( isTextSelected ) {
		return (
			<ToolbarGroup>
				<ToolbarButton
					icon={ isGenerating ? <Spinner /> : 'format-image' }
					label={
						isGenerating ? 'KaiGen is generating...' : 'KaiGen'
					}
					onClick={ onGenerateImage }
					disabled={ isGenerating }
				/>
			</ToolbarGroup>
		);
	}

	return null;
};

export default AIImageToolbar;
