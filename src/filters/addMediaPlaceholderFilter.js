// Adds KaiGen to the empty image block placeholder.

import { addFilter } from '@wordpress/hooks';
import AITab from '../components/AITab';
import {
	getSelectedImageBlock,
	shouldDisplayForSelectedImageBlock,
} from './mediaUtils';

addFilter(
	'editor.MediaPlaceholder',
	'kaigen/add-ai-placeholder-button',
	( OriginalMediaPlaceholder ) => {
		return ( props ) => {
			const selectedBlock = getSelectedImageBlock();
			const shouldDisplay = shouldDisplayForSelectedImageBlock(
				props,
				selectedBlock,
				{ requireEmptyImage: true }
			);
			const kaiGenButton = (
				<AITab
					onSelect={ props.onSelect }
					shouldDisplay={ shouldDisplay }
					variant="placeholder"
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
				<OriginalMediaPlaceholder
					{ ...props }
					placeholder={ placeholder }
				>
					{ props.children }
					{ ! props.placeholder && kaiGenButton }
				</OriginalMediaPlaceholder>
			);
		};
	}
);
