// Adds KaiGen to the empty image block placeholder.

import { addFilter } from '@wordpress/hooks';
import AITab from '../components/AITab';

const isImageOnlyMedia = ( allowedTypes = [] ) => {
	return (
		allowedTypes.length > 0 &&
		allowedTypes.every(
			( allowedType ) =>
				allowedType === 'image' || allowedType.startsWith( 'image/' )
		)
	);
};

const shouldDisplayForSelectedImageBlock = ( props ) => {
	const selectedBlock = wp.data
		.select( 'core/block-editor' )
		.getSelectedBlock();
	const hasApiKey = wp.data
		.select( 'core/editor' )
		?.getEditorSettings()?.kaigen_has_api_key;

	return (
		isImageOnlyMedia( props.allowedTypes ) &&
		! props.multiple &&
		selectedBlock?.name === 'core/image' &&
		! selectedBlock?.attributes?.url &&
		hasApiKey
	);
};

addFilter(
	'editor.MediaPlaceholder',
	'kaigen/add-ai-placeholder-button',
	( OriginalMediaPlaceholder ) => {
		return ( props ) => {
			const shouldDisplay = shouldDisplayForSelectedImageBlock( props );
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
