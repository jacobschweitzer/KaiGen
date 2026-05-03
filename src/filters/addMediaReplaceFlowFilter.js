// Adds KaiGen to the image block Add image/Replace dropdown menu.

import { useState } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import AITab from '../components/AITab';
import GenerateImageModal from '../components/GenerateImageModal';
import {
	getCurrentImage,
	getSelectedImageBlock,
	shouldDisplayForSelectedImageBlock,
} from './mediaUtils';

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
