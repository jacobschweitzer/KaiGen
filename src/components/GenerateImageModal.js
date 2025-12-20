// This file contains the GenerateImageModal component - a shared modal for AI image generation.

import { useState, useEffect } from '@wordpress/element';
import {
	Button,
	TextareaControl,
	Modal,
	Spinner,
	Dropdown,
	Dashicon,
} from '@wordpress/components';
import { generateImage, fetchReferenceImages } from '../api';

const kaiGenLogo = window.kaiGen?.logoUrl;

/**
 * GenerateImageModal component - shared modal for generating AI images.
 *
 * @param {Object}   props                         - The properties object.
 * @param {boolean}  props.isOpen                  - Whether the modal is open.
 * @param {Function} props.onClose                 - Callback when modal is closed.
 * @param {Function} props.onSelect                - Callback to handle the generated image.
 * @param {Object}   [props.initialReferenceImage] - Optional initial reference image to pre-select.
 * @return {JSX.Element|null} The rendered modal or null if not open.
 */
const GenerateImageModal = ( {
	isOpen,
	onClose,
	onSelect,
	initialReferenceImage,
} ) => {
	const [ prompt, setPrompt ] = useState( '' );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ error, setError ] = useState( null );
	const [ referenceImages, setReferenceImages ] = useState( [] );
	const [ selectedRefs, setSelectedRefs ] = useState( [] );
	const [ aspectRatio, setAspectRatio ] = useState( '1:1' );

	const provider =
		wp.data.select( 'core/editor' )?.getEditorSettings()?.kaigen_provider ||
		'replicate';
	const maxRefs = provider === 'replicate' ? 10 : 16;

	useEffect( () => {
		if ( isOpen ) {
			fetchReferenceImages().then( setReferenceImages );

			// Pre-select initial reference image if provided
			if ( initialReferenceImage && initialReferenceImage.url ) {
				setSelectedRefs( [ initialReferenceImage ] );
			} else {
				setSelectedRefs( [] );
			}
		}
	}, [ isOpen, initialReferenceImage ] );

	/**
	 * Handles Enter key press in textarea
	 *
	 * @param {KeyboardEvent} e - The keyboard event
	 * @return {void}
	 */
	const handleKeyPress = ( e ) => {
		if ( e.key === 'Enter' && ! e.shiftKey ) {
			e.preventDefault();
			handleGenerate();
		}
	};

	/**
	 * Handles the image generation process when the Generate button is clicked.
	 *
	 * @return {void}
	 */
	const handleGenerate = () => {
		if ( ! prompt.trim() ) {
			setError( 'Please enter a prompt for image generation.' );
			return;
		}
		setIsLoading( true );
		setError( null );

		const options = {};
		if ( selectedRefs.length > 0 ) {
			options.sourceImageUrls = selectedRefs.map( ( ref ) => ref.url );
		}
		if ( aspectRatio ) {
			options.aspectRatio = aspectRatio;
		}

		generateImage(
			prompt.trim(),
			( media ) => {
				if ( media.error ) {
					setError( media.error );
					setIsLoading( false );
				} else {
					onSelect( media );
					setIsLoading( false );
					handleClose();
				}
			},
			options
		);
	};

	/**
	 * Handles modal close and resets state
	 */
	const handleClose = () => {
		setPrompt( '' );
		setError( null );
		setSelectedRefs( [] );
		onClose();
	};

	if ( ! isOpen ) {
		return null;
	}

	return (
		<Modal
			className="kaigen-modal"
			title={
				<div className="kaigen-modal__logo-container">
					<img
						src={ kaiGenLogo }
						alt="KaiGen logo"
						className="kaigen-modal__logo"
					/>
				</div>
			}
			aria-label="KaiGen"
			onRequestClose={ handleClose }
		>
			{ /* Display error message if present. */ }
			{ error && <p className="kaigen-error-text">{ error }</p> }

			{ /* Horizontal layout container */ }
			<div className="kaigen-modal__input-container">
				{ /* Left: Reference Images Button */ }
				<Dropdown
					popoverProps={ {
						placement: 'bottom-start',
						focusOnMount: true,
					} }
					renderToggle={ ( { isOpen: isDropdownOpen, onToggle } ) => (
						<Button
							className={ `kaigen-modal__ref-button ${
								selectedRefs.length > 0
									? 'kaigen-ref-button-selected'
									: ''
							}` }
							onClick={ onToggle }
							aria-expanded={ isDropdownOpen }
							aria-label="Reference Images"
						>
							<Dashicon
								icon="format-image"
								className={
									selectedRefs.length > 0
										? 'kaigen-ref-button-icon-selected'
										: ''
								}
							/>
						</Button>
					) }
					renderContent={ () => {
						// Combine initial reference image with library images, avoiding duplicates
						const allImages = initialReferenceImage
							? [
									initialReferenceImage,
									...referenceImages.filter(
										( img ) =>
											img.id !== initialReferenceImage.id
									),
							  ]
							: referenceImages;

						return (
							<div className="kaigen-modal-dropdown-content-container">
								<h4 className="kaigen-modal-dropdown-content-title">
									Reference Images (up to { maxRefs })
								</h4>
								{ allImages.length > 0 ? (
									<div className="kaigen-modal-reference-images-container">
										{ allImages.map( ( img, index ) => (
											<img
												key={
													img.id ||
													`initial-${ index }`
												}
												src={ img.url }
												alt={ img.alt || '' }
												onClick={ () => {
													setSelectedRefs(
														( prev ) => {
															const isSelected =
																prev.some(
																	( s ) =>
																		s.url ===
																		img.url
																);
															if ( isSelected ) {
																return prev.filter(
																	( s ) =>
																		s.url !==
																		img.url
																);
															} else if (
																prev.length <
																maxRefs
															) {
																return [
																	...prev,
																	img,
																];
															}
															return prev;
														}
													);
												} }
												className={ `kaigen-modal-reference-image ${
													selectedRefs.some(
														( s ) =>
															s.url === img.url
													)
														? 'kaigen-modal-reference-image-selected'
														: ''
												}` }
											/>
										) ) }
									</div>
								) : (
									<p className="kaigen-modal-no-references">
										No reference images. Mark images in the
										Media Library to use them here.
									</p>
								) }
							</div>
						);
					} }
				/>

				{ /* Center: Prompt Textarea */ }
				<div className="kaigen-modal__textarea-container">
					<TextareaControl
						className="kaigen-modal__textarea"
						placeholder="Image prompt..."
						value={ prompt }
						onChange={ setPrompt }
						onKeyDown={ handleKeyPress }
						rows={ 2 }
						autoFocus
					/>
				</div>

				{ /* Submit button - only shown when there's a prompt */ }
				{ prompt.trim() && (
					<Button
						className="kaigen-modal__submit-button"
						variant="primary"
						onClick={ handleGenerate }
						disabled={ isLoading || ! prompt.trim() }
						aria-label="Generate Image"
					>
						{ isLoading ? (
							<Spinner />
						) : (
							<Dashicon icon="admin-appearance" />
						) }
					</Button>
				) }

				{ /* Right: Settings Button */ }
				<Dropdown
					popoverProps={ {
						placement: 'bottom-end',
						focusOnMount: true,
					} }
					renderToggle={ ( { isOpen: isDropdownOpen, onToggle } ) => (
						<Button
							className="kaigen-modal__settings-button"
							onClick={ onToggle }
							aria-expanded={ isDropdownOpen }
							aria-label="Settings"
						>
							<Dashicon icon="admin-generic" />
						</Button>
					) }
					renderContent={ () => (
						<div className="kaigen-modal-dropdown-content-container">
							<h4 className="kaigen-modal-dropdown-content-title">
								Aspect Ratio
							</h4>
							<div className="kaigen-modal-aspect-ratio-container">
								{ [
									{
										value: '1:1',
										label: '1:1',
										title: 'Square',
									},
									{
										value: '16:9',
										label: '16:9',
										title: 'Landscape',
									},
									{
										value: '9:16',
										label: '9:16',
										title: 'Portrait',
									},
								].map( ( opt ) => (
									<div
										key={ opt.value }
										onClick={ () =>
											setAspectRatio( ( prev ) =>
												prev === opt.value
													? null
													: opt.value
											)
										}
										aria-pressed={
											aspectRatio === opt.value
										}
										aria-label={ `${ opt.title } (${ opt.label })` }
										className={ `kaigen-modal__aspect-ratio-button ${
											aspectRatio === opt.value
												? 'kaigen-modal__aspect-ratio-button-selected'
												: ''
										}` }
									>
										<div className="kaigen-modal-aspect-ratio-icon-container">
											<div
												className={ `kaigen-modal-aspect-ratio-icon ${
													aspectRatio === opt.value
														? 'kaigen-modal-aspect-ratio-icon-selected'
														: ''
												} kaigen-aspect-ratio-${ opt.value.replace(
													':',
													'-'
												) }` }
											></div>
										</div>
										<span className="kaigen-modal-aspect-ratio-label">
											{ opt.label }
										</span>
									</div>
								) ) }
							</div>
						</div>
					) }
				/>
			</div>
		</Modal>
	);
};

export default GenerateImageModal;
