// This file modifies the block editor for core/image blocks to include an AI image regeneration button.

import { addFilter } from '@wordpress/hooks';
import { useState, useEffect } from '@wordpress/element';
import { BlockControls, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, CheckboxControl } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
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

			const hasValidId =
				props.attributes.id &&
				typeof props.attributes.id === 'number' &&
				props.attributes.id > 0;
			const [ hasInitialized, setHasInitialized ] = useState( false );
			const [ generationMeta, setGenerationMeta ] = useState( null );
			const [ isMetaLoading, setIsMetaLoading ] = useState( false );
			const [ referenceImages, setReferenceImages ] = useState( [] );
			const [ isPanelOpen, setIsPanelOpen ] = useState( false );
			const [ fetchedAttachmentId, setFetchedAttachmentId ] =
				useState( null );

			// Destructure props for useEffect dependencies
			const {
				attributes: {
					id: blockId,
					kaigen_reference_image: referenceImage,
				},
				setAttributes,
			} = props;

			// Initialize block attribute from post meta on first load, but only if block attribute is not already set
			useEffect( () => {
				if ( ! hasValidId || hasInitialized ) {
					return;
				}

				// Only initialize if the block attribute is not explicitly set (undefined or null)
				if ( referenceImage === undefined || referenceImage === null ) {
					apiFetch( {
						path: `/wp/v2/media/${ blockId }`,
					} )
						.then( ( media ) => {
							if (
								media &&
								media.meta &&
								typeof media.meta.kaigen_reference_image !==
									'undefined'
							) {
								const metaValue =
									media.meta.kaigen_reference_image ===
										true ||
									media.meta.kaigen_reference_image === 1;
								setAttributes( {
									kaigen_reference_image: metaValue,
								} );
							}
							setHasInitialized( true );
						} )
						.catch( () => {
							// Silently fail - default to false
							setHasInitialized( true );
						} );
				} else {
					setHasInitialized( true );
				}
			}, [
				hasValidId,
				blockId,
				referenceImage,
				hasInitialized,
				setAttributes,
			] );

			useEffect( () => {
				if ( ! blockId ) {
					return;
				}

				setGenerationMeta( null );
				setReferenceImages( [] );
				setFetchedAttachmentId( null );
			}, [ blockId ] );

			useEffect( () => {
				if ( ! isPanelOpen || ! blockId ) {
					return;
				}

				if ( fetchedAttachmentId === blockId ) {
					return;
				}

				setIsMetaLoading( true );
				apiFetch( {
					path: `/kaigen/v1/generation-meta?attachment_id=${ blockId }`,
				} )
					.then( ( meta ) => {
						setGenerationMeta(
							meta && Object.keys( meta ).length ? meta : null
						);
					} )
					.catch( () => {
						setGenerationMeta( null );
					} )
					.finally( () => {
						setIsMetaLoading( false );
						setFetchedAttachmentId( blockId );
					} );
			}, [ isPanelOpen, blockId, fetchedAttachmentId ] );

			useEffect( () => {
				if (
					! isPanelOpen ||
					! generationMeta ||
					! Array.isArray( generationMeta.reference_image_ids ) ||
					! generationMeta.reference_image_ids.length
				) {
					setReferenceImages( [] );
					return;
				}

				const ids = generationMeta.reference_image_ids.join( ',' );
				apiFetch( {
					path: `/wp/v2/media?include=${ ids }&per_page=${ generationMeta.reference_image_ids.length }`,
				} )
					.then( ( media ) => {
						const images = Array.isArray( media )
							? media
									.map( ( item ) => ( {
										id: item.id,
										url:
											item.media_details?.sizes?.thumbnail
												?.source_url || item.source_url,
									} ) )
									.filter( ( item ) => item.url )
							: [];
						setReferenceImages( images );
					} )
					.catch( () => {
						setReferenceImages( [] );
					} );
			}, [ isPanelOpen, generationMeta ] );

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

				wp.data
					.dispatch( 'core/notices' )
					.createSuccessNotice( 'Image generated successfully!', {
						type: 'snackbar',
					} );
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
							<PanelBody
								title="KaiGen Settings"
								initialOpen={ false }
								onToggle={ ( nextOpen ) => {
									setIsPanelOpen( nextOpen );
								} }
							>
								<CheckboxControl
									label="Reference image"
									checked={
										props.attributes
											.kaigen_reference_image === true
									}
									onChange={ async ( newValue ) => {
										// Explicitly set to boolean true or false (not undefined)
										const boolValue = newValue === true;
										props.setAttributes( {
											kaigen_reference_image: boolValue,
										} );
										setHasInitialized( true ); // Mark as initialized so we don't sync from meta again

										try {
											await apiFetch( {
												path: `/wp/v2/media/${ props.attributes.id }`,
												method: 'POST',
												data: {
													meta: {
														kaigen_reference_image:
															boolValue ? 1 : 0,
													},
												},
											} );
										} catch ( err ) {
											wp.data
												.dispatch( 'core/notices' )
												.createErrorNotice(
													'Failed to update reference image meta',
													{ type: 'snackbar' }
												);
										}
									} }
									help="Add to the list of reference images."
								/>
								{ isMetaLoading && (
									<p className="kaigen-generation-meta-loading">
										Loading generation details...
									</p>
								) }
								{ ! isMetaLoading && generationMeta && (
									<table className="kaigen-generation-meta-table">
										<tbody>
											<tr>
												<th>Prompt</th>
												<td>
													{ generationMeta.prompt }
												</td>
											</tr>
											<tr>
												<th>Provider</th>
												<td>
													{ generationMeta.provider }
												</td>
											</tr>
											<tr>
												<th>Quality</th>
												<td>
													{ generationMeta.quality }
												</td>
											</tr>
											<tr>
												<th>Model</th>
												<td>
													{ generationMeta.model }
												</td>
											</tr>
											{ referenceImages.length > 0 && (
												<tr>
													<th>References</th>
													<td>
														<div className="kaigen-generation-meta-images">
															{ referenceImages.map(
																( image ) => (
																	<img
																		key={
																			image.id
																		}
																		src={
																			image.url
																		}
																		alt=""
																		className="kaigen-generation-meta-image"
																	/>
																)
															) }
														</div>
													</td>
												</tr>
											) }
										</tbody>
									</table>
								) }
							</PanelBody>
						</InspectorControls>
					) }
				</>
			);
		};
	}
);

// Extend the core/image block to include the new attribute.
addFilter(
	'blocks.registerBlockType',
	'kaigen/add-reference-image-attribute',
	( settings, name ) => {
		if ( name !== 'core/image' ) {
			return settings;
		}

		return {
			...settings,
			attributes: {
				...settings.attributes,
				kaigen_reference_image: {
					type: 'boolean',
					default: false,
				},
			},
		};
	}
);
