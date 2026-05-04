export const isImageOnlyMedia = ( allowedTypes = [] ) => {
	return (
		allowedTypes.length > 0 &&
		allowedTypes.every(
			( allowedType ) =>
				allowedType === 'image' || allowedType.startsWith( 'image/' )
		)
	);
};

export const getSelectedImageBlock = () => {
	const selectedBlock = wp.data
		.select( 'core/block-editor' )
		.getSelectedBlock();

	return selectedBlock?.name === 'core/image' ? selectedBlock : null;
};

export const hasKaiGenApiKey = () =>
	wp.data.select( 'core/editor' )?.getEditorSettings()?.kaigen_has_api_key;

export const getCurrentImage = ( selectedBlock ) => {
	if ( ! selectedBlock?.attributes?.url ) {
		return null;
	}

	return {
		url: selectedBlock.attributes.url,
		id: selectedBlock.attributes.id,
		alt: selectedBlock.attributes.alt || '',
	};
};

export const shouldDisplayForSelectedImageBlock = (
	props,
	selectedBlock,
	{ requireEmptyImage = false } = {}
) =>
	isImageOnlyMedia( props.allowedTypes ) &&
	! props.multiple &&
	selectedBlock?.name === 'core/image' &&
	( ! requireEmptyImage || ! selectedBlock?.attributes?.url ) &&
	hasKaiGenApiKey();
