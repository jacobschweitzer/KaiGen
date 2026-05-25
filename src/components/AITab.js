// This file contains the AITab React trigger component.

import { Button, MenuItem } from '@wordpress/components';

const kaiGenLogoBig = window.kaiGen?.logoUrl;

/**
 * AITab component for opening AI image generation.
 *
 * @param {Object}   props               - The properties object.
 * @param {boolean}  props.shouldDisplay - Flag indicating whether to render the AITab.
 * @param {string}   props.variant       - The UI variant to render.
 * @param {Function} props.onClick       - Callback after clicking the control.
 * @return {JSX.Element|null} The rendered AITab component or null if not displayed.
 */
const AITab = ( { shouldDisplay, variant = 'placeholder', onClick } ) => {
	// Do not render the component if shouldDisplay is false.
	if ( ! shouldDisplay ) {
		return null;
	}

	if ( variant === 'menu' ) {
		return (
			<MenuItem
				onClick={ onClick }
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
		);
	}

	return (
		<Button
			onClick={ onClick }
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
};

export default AITab;
