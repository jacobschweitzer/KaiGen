// This file modifies the block editor for core/image blocks to include an AI image regeneration button.

import { addFilter } from '@wordpress/hooks';
import { useState, useEffect } from '@wordpress/element';
import { BlockControls, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, CheckboxControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { dispatch } from '@wordpress/data';
import AIImageToolbar from '../components/AIImageToolbar';

/**
 * Enhances the core/image block with an AI image regeneration button.
 *
 * @param {Function} BlockEdit - The original BlockEdit component.
 * @return {Function} A new BlockEdit component with additional regeneration functionality.
 */
addFilter(
	'editor.BlockEdit',
	'kaigen/add-regenerate-button',
	( BlockEdit ) => {
		return ( props ) => {
			if ( props.name !== 'core/image' ) {
				return <BlockEdit { ...props } />;
			}

			const normalizedBlockId = Number( props.attributes.id );
			const hasValidId =
				Number.isInteger( normalizedBlockId ) && normalizedBlockId > 0;
			const [ isReferenceImage, setIsReferenceImage ] = useState( false );

			const { setAttributes } = props;

			useEffect( () => {
				if ( ! hasValidId ) {
					setIsReferenceImage( false );
					return;
				}

				let isCurrent = true;

				apiFetch( {
					path: `/wp/v2/media/${ normalizedBlockId }`,
				} )
					.then( ( media ) => {
						if ( ! isCurrent ) {
							return;
						}

						setIsReferenceImage(
							media?.meta?.kaigen_reference_image === true ||
								media?.meta?.kaigen_reference_image === 1
						);
					} )
					.catch( () => {
						if ( isCurrent ) {
							setIsReferenceImage( false );
						}
					} );

				return () => {
					isCurrent = false;
				};
			}, [ hasValidId, normalizedBlockId ] );

			useEffect( () => {
				if ( ! normalizedBlockId ) {
					return;
				}

				if ( props.attributes.id !== normalizedBlockId ) {
					setAttributes( { id: normalizedBlockId } );
				}
			}, [ normalizedBlockId, props.attributes.id, setAttributes ] );

			/**
			 * Build current image object for the modal
			 */
			const currentImage = props.attributes.url
				? {
						url: props.attributes.url,
						id: props.attributes.id,
						alt: props.attributes.alt || '',
				  }
				: null;

			/**
			 * Handles the generated image result from the modal.
			 *
			 * @param {Object} result - The generated image data.
			 */
			const handleImageGenerated = ( result ) => {
				if (
					result.id &&
					typeof result.id === 'number' &&
					result.id > 0
				) {
					props.setAttributes( {
						url: result.url,
						id: result.id,
					} );
				} else {
					props.setAttributes( {
						url: result.url,
						id: undefined,
					} );
				}

				dispatch( 'core/notices' ).createSuccessNotice(
					'Image generated successfully!',
					{
						type: 'snackbar',
					}
				);
			};

			return (
				<>
					<BlockEdit { ...props } />
					{ props.attributes.url && (
						<BlockControls>
							<AIImageToolbar
								onImageGenerated={ handleImageGenerated }
								isImageBlock={ true }
								currentImage={ currentImage }
							/>
						</BlockControls>
					) }
					{ hasValidId && (
						<InspectorControls>
							<PanelBody title="KaiGen" initialOpen={ false }>
								<CheckboxControl
									label="Reference image"
									checked={ isReferenceImage }
									onChange={ async ( newValue ) => {
										const boolValue = newValue === true;
										const previousValue = isReferenceImage;
										setIsReferenceImage( boolValue );

										try {
											await apiFetch( {
												path: `/wp/v2/media/${ normalizedBlockId }`,
												method: 'POST',
												data: {
													meta: {
														kaigen_reference_image:
															boolValue ? 1 : 0,
													},
												},
											} );
										} catch ( err ) {
											setIsReferenceImage(
												previousValue
											);
											dispatch(
												'core/notices'
											).createErrorNotice(
												'Failed to update reference image meta',
												{ type: 'snackbar' }
											);
										}
									} }
									help="Add to the list of reference images."
								/>
							</PanelBody>
						</InspectorControls>
					) }
				</>
			);
		};
	}
);
