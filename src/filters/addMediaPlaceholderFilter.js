// Adds KaiGen to the empty image block placeholder.

import { useState } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import AITab from '../components/AITab';
import GenerateImageModal from '../components/GenerateImageModal';
import {
	getSelectedImageBlock,
	shouldDisplayForSelectedImageBlock,
} from './mediaUtils';

addFilter(
	'editor.MediaPlaceholder',
	'kaigen/add-ai-placeholder-button',
	( OriginalMediaPlaceholder ) => {
		return ( props ) => {
			const [ isModalOpen, setIsModalOpen ] = useState( false );
			const selectedBlock = getSelectedImageBlock();
			const shouldDisplay = shouldDisplayForSelectedImageBlock(
				props,
				selectedBlock,
				{ requireEmptyImage: true }
			);
			const kaiGenButton = (
				<AITab
					shouldDisplay={ shouldDisplay }
					variant="placeholder"
					onClick={ () => setIsModalOpen( true ) }
				/>
			);
			const placeholder = props.placeholder
				? ( content ) =>
						props.placeholder(
							<>
								{ content }
								{ kaiGenButton }
							</>
						)
				: undefined;

			return (
				<>
					<OriginalMediaPlaceholder
						{ ...props }
						placeholder={ placeholder }
					>
						{ props.children }
						{ ! props.placeholder && kaiGenButton }
					</OriginalMediaPlaceholder>
					<GenerateImageModal
						isOpen={ isModalOpen }
						onClose={ () => setIsModalOpen( false ) }
						onSelect={ props.onSelect }
					/>
				</>
			);
		};
	}
);
