// This file contains the AITab React component used to generate AI images through a modal.

import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import GenerateImageModal from './GenerateImageModal';

const kaiGenLogoBig = window.kaiGen?.logoUrl;

/**
 * AITab component for generating AI images.
 *
 * @param {Object}   props               - The properties object.
 * @param {Function} props.onSelect      - The callback function to handle the selected image.
 * @param {boolean}  props.shouldDisplay - Flag indicating whether to render the AITab.
 * @return {JSX.Element|null} The rendered AITab component or null if not displayed.
 */
const AITab = ( { onSelect, shouldDisplay } ) => {
	const [ isModalOpen, setIsModalOpen ] = useState( false );

	// Do not render the component if shouldDisplay is false.
	if ( ! shouldDisplay ) {
		return null;
	}

	return (
		<>
			{ /* KaiGen button for placeholder context (shown in editor canvas) */ }
			<Button
				onClick={ () => setIsModalOpen( true ) }
				className="kaigen-placeholder-button"
				aria-label="KaiGen"
			>
				<img
					src={ kaiGenLogoBig }
					alt="KaiGen"
					style={ { width: '48px', height: '48px' } }
				/>
			</Button>

			{ /* KaiGen button for dropdown/popover context (styled as menu item) */ }
			<button
				type="button"
				role="menuitem"
				onClick={ () => setIsModalOpen( true ) }
				className="components-button components-menu-item__button is-next-40px-default-size kaigen-menu-item-button"
			>
				<span className="components-menu-item__item">KaiGen</span>
				<img
					src={ kaiGenLogoBig }
					alt=""
					aria-hidden="true"
					className="components-menu-items__item-icon has-icon-right"
					style={ { width: '24px', height: '24px' } }
				/>
			</button>

			<GenerateImageModal
				isOpen={ isModalOpen }
				onClose={ () => setIsModalOpen( false ) }
				onSelect={ onSelect }
			/>
		</>
	);
};

export default AITab;
