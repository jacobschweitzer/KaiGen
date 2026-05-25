// This file contains the GenerateImageModal component - a shared modal for AI image generation.

import { useState, useEffect } from '@wordpress/element';
import { select } from '@wordpress/data';
import {
	Button,
	TextareaControl,
	Modal,
	Dropdown,
	Dashicon,
	SelectControl,
} from '@wordpress/components';
import { generateImage, fetchReferenceImages } from '../api';
import useGenerationProgress from '../hooks/useGenerationProgress';

const kaiGenLogo = window.kaiGen?.logoUrl;

/**
 * GenerateImageModal component - shared modal for generating AI images.
 *
 * @param {Object}   props                         - The properties object.
 * @param {boolean}  props.isOpen                  - Whether the modal is open.
 * @param {Function} props.onClose                 - Callback when modal is closed.
 * @param {Function} props.onSelect                - Callback to handle the generated image.
 * @param {Object}   [props.initialReferenceImage] - Optional initial reference image to pre-select.
 * @return {Object|null} The rendered modal or null if not open.
 */
const DEFAULT_REFERENCE_IMAGE_LIMIT = 5;

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
	const [ provider, setProvider ] = useState( 'auto' );
	const [ orientation, setOrientation ] = useState( 'square' );

	const editorSettings = select( 'core/editor' )?.getEditorSettings() || {};
	const kaiGenSettings = editorSettings.kaigen_settings || {};
	const availableProviders = kaiGenSettings.providers || [
		{
			id: 'auto',
			name: 'Auto',
			referenceImageLimit: DEFAULT_REFERENCE_IMAGE_LIMIT,
		},
	];
	const selectedProvider =
		availableProviders.find( ( option ) => option.id === provider ) ||
		availableProviders[ 0 ];
	const referenceImageLimit =
		Number.isInteger( selectedProvider?.referenceImageLimit ) &&
		selectedProvider.referenceImageLimit > 0
			? selectedProvider.referenceImageLimit
			: DEFAULT_REFERENCE_IMAGE_LIMIT;
	const progress = useGenerationProgress( isLoading );

	useEffect( () => {
		if ( isOpen ) {
			fetchReferenceImages().then( setReferenceImages );
			setProvider( kaiGenSettings.provider || 'auto' );
			setOrientation( kaiGenSettings.orientation || 'square' );

			// Pre-select initial reference image if provided
			if ( initialReferenceImage && initialReferenceImage.url ) {
				setSelectedRefs( [ initialReferenceImage ] );
			} else {
				setSelectedRefs( [] );
			}
		}
	}, [
		isOpen,
		initialReferenceImage,
		kaiGenSettings.provider,
		kaiGenSettings.orientation,
	] );

	useEffect( () => {
		setSelectedRefs( ( prev ) => prev.slice( 0, referenceImageLimit ) );
	}, [ referenceImageLimit ] );

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
	const handleGenerate = async () => {
		if ( ! prompt.trim() ) {
			setError( 'Please enter a prompt for image generation.' );
			return;
		}
		setIsLoading( true );
		setError( null );

		const options = {};
		if ( selectedRefs.length > 0 ) {
			options.sourceImageIds = selectedRefs
				.map( ( ref ) => ref.id )
				.filter( ( id ) => Number.isInteger( id ) && id > 0 );
		}
		options.provider = provider;
		options.orientation = orientation;

		try {
			const media = await generateImage( prompt.trim(), options );
			onSelect( media );
			setIsLoading( false );
			handleClose();
		} catch ( generationError ) {
			setError(
				generationError.message ||
					'An unknown error occurred while generating the image'
			);
			setIsLoading( false );
		}
	};

	/**
	 * Handles modal close and resets state
	 */
	const handleClose = () => {
		setPrompt( '' );
		setError( null );
		setSelectedRefs( [] );
		setProvider( kaiGenSettings.provider || 'auto' );
		setOrientation( kaiGenSettings.orientation || 'square' );
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
									Reference Images
								</h4>
								<p className="kaigen-modal-reference-limit">
									Limit { referenceImageLimit }
								</p>
								{ allImages.length > 0 ? (
									<div className="kaigen-modal-reference-images-container">
										{ allImages.map( ( img, index ) => {
											const handleImageToggle = () => {
												setSelectedRefs( ( prev ) => {
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
														referenceImageLimit
													) {
														return [ ...prev, img ];
													}
													return prev;
												} );
											};

											return (
												<button
													type="button"
													key={
														img.id ||
														`initial-${ index }`
													}
													onClick={
														handleImageToggle
													}
													className={ `kaigen-modal-reference-image ${
														selectedRefs.some(
															( s ) =>
																s.url ===
																img.url
														)
															? 'kaigen-modal-reference-image-selected'
															: ''
													}` }
													aria-label={
														img.alt ||
														'Select reference image'
													}
												>
													<img
														src={
															img.thumbnail_url ||
															img.url
														}
														alt={ img.alt || '' }
													/>
												</button>
											);
										} ) }
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
						<Dashicon icon="admin-appearance" />
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
								Provider
							</h4>
							<SelectControl
								label="Provider"
								hideLabelFromVision
								value={ provider }
								options={ availableProviders.map( ( opt ) => ( {
									value: opt.id,
									label: opt.name,
								} ) ) }
								onChange={ setProvider }
							/>
							<h4 className="kaigen-modal-dropdown-content-title">
								Orientation
							</h4>
							<div className="kaigen-modal-aspect-ratio-container">
								{ [
									{
										value: 'square',
										label: 'Square',
										title: 'Square',
									},
									{
										value: 'landscape',
										label: 'Landscape',
										title: 'Landscape',
									},
									{
										value: 'portrait',
										label: 'Portrait',
										title: 'Portrait',
									},
								].map( ( opt ) => (
									<button
										type="button"
										key={ opt.value }
										onClick={ () =>
											setOrientation( ( prev ) =>
												prev === opt.value
													? 'square'
													: opt.value
											)
										}
										aria-pressed={
											orientation === opt.value
										}
										aria-label={ opt.title }
										className={ `kaigen-modal__aspect-ratio-button ${
											orientation === opt.value
												? 'kaigen-modal__aspect-ratio-button-selected'
												: ''
										}` }
									>
										<div className="kaigen-modal-aspect-ratio-icon-container">
											<div
												className={ `kaigen-modal-aspect-ratio-icon ${
													orientation === opt.value
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
									</button>
								) ) }
							</div>
						</div>
					) }
				/>
			</div>
			{ isLoading && (
				<div className="kaigen-modal__progress">
					<div className="kaigen-modal__progress-label">
						Generating... { progress }%
					</div>
					<div
						className="kaigen-modal__progress-track"
						role="progressbar"
						aria-valuenow={ progress }
						aria-valuemin={ 0 }
						aria-valuemax={ 100 }
						aria-label="Image generation progress"
					>
						<div
							className="kaigen-modal__progress-fill"
							style={ { width: `${ progress }%` } }
						/>
					</div>
				</div>
			) }
		</Modal>
	);
};

export default GenerateImageModal;
