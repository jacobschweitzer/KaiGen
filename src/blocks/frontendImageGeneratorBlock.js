import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { PanelBody, SelectControl, TextControl } from '@wordpress/components';

registerBlockType( 'kaigen/frontend-image-generator', {
	title: __( 'KaiGen Frontend Image Generator', 'kaigen' ),
	description: __(
		'Lets logged in users generate images from the front end.',
		'kaigen'
	),
	icon: 'format-image',
	category: 'widgets',
	attributes: {
		quality: {
			type: 'string',
			default: 'medium',
		},
		promptInstruction: {
			type: 'string',
			default: __( 'Describe the image you want to create…', 'kaigen' ),
		},
	},
	edit: function Edit( { attributes, setAttributes } ) {
		const blockProps = useBlockProps();

		return (
			<>
				<InspectorControls>
					<PanelBody title={ __( 'Generation Settings', 'kaigen' ) }>
						<SelectControl
							label={ __( 'Image quality', 'kaigen' ) }
							value={ attributes.quality }
							options={ [
								{ label: __( 'Low', 'kaigen' ), value: 'low' },
								{
									label: __( 'Medium', 'kaigen' ),
									value: 'medium',
								},
								{
									label: __( 'High', 'kaigen' ),
									value: 'high',
								},
							] }
							onChange={ ( quality ) =>
								setAttributes( { quality } )
							}
						/>
						<TextControl
							label={ __( 'Prompt instruction text', 'kaigen' ) }
							help={ __(
								'This text is shown to front-end users to guide what they should type.',
								'kaigen'
							) }
							value={ attributes.promptInstruction || '' }
							onChange={ ( promptInstruction ) =>
								setAttributes( { promptInstruction } )
							}
							placeholder={ __(
								'Describe the image you want to create…',
								'kaigen'
							) }
						/>
					</PanelBody>
				</InspectorControls>
				<div { ...blockProps }>
					<p>
						{ __(
							'Front-end image generator form will render here.',
							'kaigen'
						) }
					</p>
					<p>
						{ __(
							'Only logged in users can generate images from this block.',
							'kaigen'
						) }
					</p>
					<p>
						<strong>{ __( 'Prompt hint:', 'kaigen' ) }</strong>{ ' ' }
						{ attributes.promptInstruction }
					</p>
				</div>
			</>
		);
	},
	save: () => null,
} );
