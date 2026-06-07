// This file contains the GenerateImageModal component - a shared modal for AI image generation.

import { useState, useEffect, useRef } from '@wordpress/element';
import {
	Button,
	ButtonGroup,
	TextareaControl,
	Modal,
	Dropdown,
	Dashicon,
} from '@wordpress/components';
import { generateImage, fetchReferenceImages } from '../api';
import useGenerationProgress from '../hooks/useGenerationProgress';
import {
	DEFAULT_REFERENCE_IMAGE_LIMIT,
	getKaiGenSettings,
	isKaiGenAvailable,
} from '../utils/kaigenSettings';

const kaiGenLogo = window.kaiGen?.logoUrl;

const PROVIDER_LOGOS = {
	google: '/wp-content/plugins/ai-provider-for-google/assets/images/google.svg',
	openai: '/wp-content/plugins/ai-provider-for-openai/assets/images/openai.svg',
};

const getProviderLogo = ( option ) => {
	const providerKey = `${ option.id } ${ option.name }`.toLowerCase();

	if ( providerKey.includes( 'google' ) ) {
		return PROVIDER_LOGOS.google;
	}

	if ( providerKey.includes( 'openai' ) ) {
		return PROVIDER_LOGOS.openai;
	}

	return null;
};

const ASPECT_RATIO_OPTIONS = [
	{
		value: 'square',
		ratio: '1:1',
		label: 'Square',
	},
	{
		value: 'landscape',
		ratio: '16:9',
		label: 'Wide',
	},
	{
		value: 'portrait',
		ratio: '9:16',
		label: 'Vertical',
	},
];

const getReferenceImageId = ( image ) => {
	const imageId = Number( image?.id );
	return Number.isInteger( imageId ) && imageId > 0 ? imageId : null;
};

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
	const [ showReferenceImages, setShowReferenceImages ] = useState( false );
	const textareaContainerRef = useRef( null );

	const kaiGenSettings = getKaiGenSettings();
	const availableProviders = kaiGenSettings.providers || [];
	const selectableProviders = availableProviders.filter(
		( opt ) => opt.id !== 'auto'
	);
	const hasProviderChoices = selectableProviders.length > 1;
	const selectedProvider =
		availableProviders.find( ( option ) => option.id === provider ) ||
		availableProviders[ 0 ];
	const selectedAspectRatio =
		ASPECT_RATIO_OPTIONS.find(
			( option ) => option.value === orientation
		) || ASPECT_RATIO_OPTIONS[ 0 ];
	const referenceImageLimit =
		Number.isInteger( selectedProvider?.referenceImageLimit ) &&
		selectedProvider.referenceImageLimit > 0
			? selectedProvider.referenceImageLimit
			: DEFAULT_REFERENCE_IMAGE_LIMIT;
	const initialReferenceImageId = getReferenceImageId(
		initialReferenceImage
	);
	const progress = useGenerationProgress( isLoading );

	useEffect( () => {
		if ( isOpen ) {
			fetchReferenceImages().then( setReferenceImages );
			setProvider( kaiGenSettings.provider || 'auto' );
			setOrientation( kaiGenSettings.orientation || 'square' );
			setShowReferenceImages( false );

			if ( initialReferenceImageId ) {
				setSelectedRefs( [ initialReferenceImage ] );
			} else {
				setSelectedRefs( [] );
			}
		}
	}, [
		isOpen,
		initialReferenceImage,
		initialReferenceImageId,
		kaiGenSettings.provider,
		kaiGenSettings.orientation,
	] );

	useEffect( () => {
		setSelectedRefs( ( prev ) => prev.slice( 0, referenceImageLimit ) );
	}, [ referenceImageLimit ] );

	useEffect( () => {
		const textarea =
			textareaContainerRef.current?.querySelector( 'textarea' );

		if ( ! textarea ) {
			return;
		}

		textarea.style.height = 'auto';
		textarea.style.height = `${ textarea.scrollHeight }px`;
	}, [ prompt, isOpen ] );

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
			const sourceImageIds = selectedRefs
				.map( getReferenceImageId )
				.filter( Boolean );

			if ( sourceImageIds.length > 0 ) {
				options.sourceImageIds = sourceImageIds;
			}
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
		setShowReferenceImages( false );
		onClose();
	};

	if ( ! isOpen || ! isKaiGenAvailable() ) {
		return null;
	}

	const allReferenceImages = initialReferenceImageId
		? [
				initialReferenceImage,
				...referenceImages.filter(
					( img ) =>
						getReferenceImageId( img ) !== initialReferenceImageId
				),
		  ]
		: referenceImages;

	const handleImageToggle = ( img ) => {
		const imageId = getReferenceImageId( img );
		if ( ! imageId ) {
			return;
		}

		setSelectedRefs( ( prev ) => {
			const isSelected = prev.some(
				( selected ) => getReferenceImageId( selected ) === imageId
			);

			if ( isSelected ) {
				return prev.filter(
					( selected ) => getReferenceImageId( selected ) !== imageId
				);
			} else if ( prev.length < referenceImageLimit ) {
				return [ ...prev, img ];
			}

			return prev;
		} );
	};

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

			<div className="kaigen-modal__stage">
				<div
					className={ `kaigen-modal__reference-panel ${
						showReferenceImages
							? 'kaigen-modal__reference-panel-visible'
							: ''
					}` }
					aria-hidden={ ! showReferenceImages }
				>
					{ allReferenceImages.length > 0
						? showReferenceImages && (
								<div className="kaigen-modal-reference-images-container">
									{ allReferenceImages.map(
										( img, index ) => (
											<button
												type="button"
												key={
													getReferenceImageId(
														img
													) || `initial-${ index }`
												}
												onClick={ () =>
													handleImageToggle( img )
												}
												className={ `kaigen-modal-reference-image ${
													selectedRefs.some(
														( selected ) =>
															getReferenceImageId(
																selected
															) ===
															getReferenceImageId(
																img
															)
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
										)
									) }
								</div>
						  )
						: showReferenceImages && (
								<p className="kaigen-modal-no-references">
									No reference images. Mark images in the
									Media Library to use them here.
								</p>
						  ) }
				</div>

				<div className="kaigen-modal__composer">
					<div className="kaigen-modal__prompt-row">
						<div className="kaigen-modal__prompt-action">
							<Button
								className={ `kaigen-modal__ref-button ${
									showReferenceImages ? 'is-primary' : ''
								} ${
									selectedRefs.length > 0
										? 'kaigen-ref-button-selected'
										: ''
								}` }
								onClick={ () =>
									setShowReferenceImages(
										( isVisible ) => ! isVisible
									)
								}
								aria-expanded={ showReferenceImages }
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
						</div>

						<div
							className="kaigen-modal__textarea-container"
							ref={ textareaContainerRef }
						>
							<TextareaControl
								className="kaigen-modal__textarea"
								placeholder="Type to imagine"
								value={ prompt }
								onChange={ setPrompt }
								onKeyDown={ handleKeyPress }
								rows={ 1 }
							/>
						</div>

						<Button
							className="kaigen-modal__submit-button"
							variant={ prompt.trim() ? 'primary' : undefined }
							onClick={ handleGenerate }
							disabled={ isLoading || ! prompt.trim() }
							aria-label="Generate Image"
						>
							<Dashicon icon="admin-appearance" />
						</Button>
					</div>

					<div className="kaigen-modal__options-row">
						{ hasProviderChoices && (
							<ButtonGroup
								className="kaigen-modal__provider-options"
								role="radiogroup"
								aria-label="Provider"
							>
								{ availableProviders.map( ( opt ) => {
									const providerLogo = getProviderLogo( opt );

									return (
										<Button
											key={ opt.id }
											role="radio"
											aria-checked={ provider === opt.id }
											aria-label={ opt.name }
											onClick={ () =>
												setProvider( opt.id )
											}
											className={ `kaigen-modal__provider-button ${
												provider === opt.id
													? 'kaigen-modal__provider-button-selected'
													: ''
											} ${
												providerLogo ||
												opt.id === 'auto'
													? 'kaigen-modal__provider-button-icon-only'
													: ''
											}` }
										>
											{ providerLogo && (
												<img
													src={ providerLogo }
													alt=""
													aria-hidden="true"
													className="kaigen-modal__provider-logo"
												/>
											) }
											{ ! providerLogo && (
												<span>{ opt.name }</span>
											) }
										</Button>
									);
								} ) }
							</ButtonGroup>
						) }

						<Dropdown
							popoverProps={ {
								placement: 'top-start',
								focusOnMount: true,
							} }
							renderToggle={ ( {
								isOpen: isDropdownOpen,
								onToggle,
							} ) => (
								<Button
									className="kaigen-modal__aspect-ratio-toggle"
									onClick={ onToggle }
									aria-expanded={ isDropdownOpen }
									aria-label="Aspect Ratio"
								>
									<span
										className={ `kaigen-modal-aspect-ratio-icon kaigen-aspect-ratio-${ selectedAspectRatio.value }` }
									></span>
									<span className="kaigen-modal__aspect-ratio-ratio">
										{ selectedAspectRatio.ratio }
									</span>
								</Button>
							) }
							renderContent={ ( { onClose: closeDropdown } ) => (
								<div
									className="kaigen-modal__aspect-ratio-menu"
									role="menu"
								>
									{ ASPECT_RATIO_OPTIONS.map( ( opt ) => (
										<button
											type="button"
											key={ opt.value }
											className={ `kaigen-modal__aspect-ratio-menu-item ${
												orientation === opt.value
													? 'kaigen-modal__aspect-ratio-menu-item-selected'
													: ''
											}` }
											onClick={ () => {
												setOrientation( opt.value );
												closeDropdown();
											} }
											role="menuitemradio"
											aria-checked={
												orientation === opt.value
											}
										>
											<span
												className={ `kaigen-modal-aspect-ratio-icon kaigen-aspect-ratio-${ opt.value }` }
											></span>
											<span className="kaigen-modal__aspect-ratio-ratio">
												{ opt.ratio }
											</span>
											<span className="kaigen-modal__aspect-ratio-name">
												{ opt.label }
											</span>
										</button>
									) ) }
								</div>
							) }
						/>
					</div>
				</div>
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
