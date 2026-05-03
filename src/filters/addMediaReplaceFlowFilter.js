// Adds KaiGen to the image block Add image/Replace dropdown menu.

import { useState } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import AITab from '../components/AITab';
import GenerateImageModal from '../components/GenerateImageModal';

const isImageOnlyMedia = ( allowedTypes = [] ) => {
	return (
		allowedTypes.length > 0 &&
		allowedTypes.every(
			( allowedType ) =>
				allowedType === 'image' || allowedType.startsWith( 'image/' )
		)
	);
};

const getSelectedImageBlock = () =>
	wp.data.select( 'core/block-editor' ).getSelectedBlock();

const getCurrentImage = ( selectedBlock ) => {
	if ( ! selectedBlock?.attributes?.url ) {
		return null;
	}

	return {
		url: selectedBlock.attributes.url,
		id: selectedBlock.attributes.id,
		alt: selectedBlock.attributes.alt || '',
	};
};

const shouldDisplayForSelectedImageBlock = ( props, selectedBlock ) => {
	const hasApiKey = wp.data
		.select( 'core/editor' )
		?.getEditorSettings()?.kaigen_has_api_key;

	return (
		isImageOnlyMedia( props.allowedTypes ) &&
		! props.multiple &&
		selectedBlock?.name === 'core/image' &&
		hasApiKey
	);
};

addFilter(
	'editor.MediaReplaceFlow',
	'kaigen/add-ai-media-replace-menu-item',
	( OriginalMediaReplaceFlow ) => {
		return ( props ) => {
			const [ isModalOpen, setIsModalOpen ] = useState( false );
			const originalChildren = props.children;
			const selectedBlock = getSelectedImageBlock();
			const shouldDisplay = shouldDisplayForSelectedImageBlock(
				props,
				selectedBlock
			);
			const currentImage = getCurrentImage( selectedBlock );

			return (
				<>
					<OriginalMediaReplaceFlow
						{ ...props }
						children={ ( childProps ) => (
							<>
								{ typeof originalChildren === 'function'
									? originalChildren( childProps )
									: originalChildren }
								<AITab
									onSelect={ props.onSelect }
									shouldDisplay={ shouldDisplay }
									variant="menu"
									onClick={ () => {
										setIsModalOpen( true );
										childProps?.onClose?.();
									} }
									renderModal={ false }
								/>
							</>
						) }
					/>
					<GenerateImageModal
						isOpen={ isModalOpen }
						onClose={ () => setIsModalOpen( false ) }
						onSelect={ props.onSelect }
						initialReferenceImage={ currentImage }
					/>
				</>
			);
		};
	}
);
