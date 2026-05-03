// This file contains the AITab React component used to generate AI images through a modal.

import { useState } from '@wordpress/element';
import { Button, MenuItem } from '@wordpress/components';
import GenerateImageModal from './GenerateImageModal';

const kaiGenLogoBig = window.kaiGen?.logoUrl;

/**
 * AITab component for generating AI images.
 *
 * @param {Object}   props               - The properties object.
 * @param {Function} props.onSelect      - The callback function to handle the selected image.
 * @param {boolean}  props.shouldDisplay - Flag indicating whether to render the AITab.
 * @param {string}   props.variant       - The UI variant to render.
 * @param {Function} props.onClick       - Optional callback after clicking the control.
 * @param {boolean}  props.renderModal   - Whether to render the modal from this component.
 * @return {JSX.Element|null} The rendered AITab component or null if not displayed.
 */
const AITab = ( {
	onSelect,
	shouldDisplay,
	variant = 'placeholder',
	onClick,
	renderModal = true,
} ) => {
	const [ isModalOpen, setIsModalOpen ] = useState( false );

	// Do not render the component if shouldDisplay is false.
	if ( ! shouldDisplay ) {
		return null;
	}

	const openModal = () => {
		setIsModalOpen( true );
		onClick?.();
	};

	const control =
		variant === 'menu' ? (
			<MenuItem
				onClick={ openModal }
				className="kaigen-menu-item-button"
				icon={
					<img
						src={ kaiGenLogoBig }
						alt=""
						aria-hidden="true"
						style={ { width: '24px', height: '24px' } }
					/>
				}
			>
				KaiGen
			</MenuItem>
		) : (
			<Button
				onClick={ openModal }
				className="kaigen-placeholder-button"
				aria-label="KaiGen"
			>
				<img
					src={ kaiGenLogoBig }
					alt="KaiGen"
					style={ { width: '48px', height: '48px' } }
				/>
			</Button>
		);

	return (
		<>
			{ control }

			{ renderModal && (
				<GenerateImageModal
					isOpen={ isModalOpen }
					onClose={ () => setIsModalOpen( false ) }
					onSelect={ onSelect }
				/>
			) }
		</>
	);
};

export default AITab;
