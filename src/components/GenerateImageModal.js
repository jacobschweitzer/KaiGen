// This file contains the GenerateImageModal component - a shared modal for AI image generation.

import { useState, useEffect, useRef } from '@wordpress/element';
import {
	Button,
	TextareaControl,
	Modal,
	Dropdown,
	Dashicon,
} from '@wordpress/components';
import { generateImage, fetchReferenceImages } from '../api';
import useGenerationProgress from '../hooks/useGenerationProgress';
import {
	appendPromptDetail,
	extractPromptTerms,
	getRefinementStage,
	getTermExpansionChoices,
	REFINEMENT_STAGES,
	replacePromptTerm,
} from '../utils/promptRefinement';
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
	const [ generatedImage, setGeneratedImage ] = useState( null );
	const [ provider, setProvider ] = useState( 'auto' );
	const [ orientation, setOrientation ] = useState( 'square' );
	const [ isInteractiveMode, setIsInteractiveMode ] = useState( false );
	const [ activeRefinementStage, setActiveRefinementStage ] =
		useState( 'idea' );
	const [ isListening, setIsListening ] = useState( false );
	const [ voiceStatus, setVoiceStatus ] = useState( '' );
	const textareaContainerRef = useRef( null );
	const speechRecognitionRef = useRef( null );

	const kaiGenSettings = getKaiGenSettings();
	const availableProviders = kaiGenSettings.providers || [];
	const selectableProviders = availableProviders.filter(
		( opt ) => opt.id !== 'auto'
	);
	const hasProviderChoices = selectableProviders.length > 1;
	const selectedProvider =
		availableProviders.find( ( option ) => option.id === provider ) ||
		availableProviders[ 0 ];
	const selectedProviderLogo = selectedProvider
		? getProviderLogo( selectedProvider )
		: null;
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
			setGeneratedImage(
				initialReferenceImage?.url ? initialReferenceImage : null
			);

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

	useEffect( () => {
		return () => {
			speechRecognitionRef.current?.abort?.();
			window.speechSynthesis?.cancel?.();
		};
	}, [] );

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
			setGeneratedImage( media );
			setSelectedRefs( getReferenceImageId( media ) ? [ media ] : [] );
			onSelect( media );
			setIsLoading( false );
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
		setGeneratedImage( null );
		setProvider( kaiGenSettings.provider || 'auto' );
		setOrientation( kaiGenSettings.orientation || 'square' );
		setIsInteractiveMode( false );
		setActiveRefinementStage( 'idea' );
		setIsListening( false );
		setVoiceStatus( '' );
		speechRecognitionRef.current?.abort?.();
		window.speechSynthesis?.cancel?.();
		onClose();
	};

	if ( ! isOpen || ! isKaiGenAvailable() ) {
		return null;
	}

	const currentRefinementStage = getRefinementStage( activeRefinementStage );
	const promptTerms = extractPromptTerms( prompt );
	const SpeechRecognition =
		window.SpeechRecognition || window.webkitSpeechRecognition;
	const canUseSpeechRecognition = Boolean( SpeechRecognition );
	const canUseSpeechSynthesis = Boolean(
		window.speechSynthesis && window.SpeechSynthesisUtterance
	);

	const allReferenceImages = [
		generatedImage,
		initialReferenceImageId ? initialReferenceImage : null,
		...referenceImages,
	].filter( ( img, index, images ) => {
		const imageId = getReferenceImageId( img );

		if ( ! imageId ) {
			return false;
		}

		return (
			images.findIndex(
				( candidate ) => getReferenceImageId( candidate ) === imageId
			) === index
		);
	} );

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

	const handleAppendPromptDetail = ( detail ) => {
		setPrompt( ( currentPrompt ) =>
			appendPromptDetail( currentPrompt, detail )
		);
	};

	const handleTermExpansion = ( term, choice ) => {
		setPrompt( ( currentPrompt ) =>
			replacePromptTerm( currentPrompt, term, choice )
		);
	};

	const handleVoiceInput = () => {
		if ( ! canUseSpeechRecognition ) {
			setVoiceStatus( 'Voice input is not supported in this browser.' );
			return;
		}

		if ( isListening ) {
			speechRecognitionRef.current?.stop?.();
			return;
		}

		const recognition = new SpeechRecognition();
		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.lang = window.navigator?.language || 'en-US';
		recognition.onstart = () => {
			setIsListening( true );
			setVoiceStatus( 'Listening...' );
		};
		recognition.onresult = ( event ) => {
			const transcript = Array.from( event.results )
				.map( ( result ) => result[ 0 ]?.transcript || '' )
				.join( ' ' )
				.trim();

			if ( transcript ) {
				handleAppendPromptDetail( transcript );
				setVoiceStatus( `Added: ${ transcript }` );
			} else {
				setVoiceStatus( 'No speech recognized.' );
			}
		};
		recognition.onerror = () => {
			setVoiceStatus( 'Voice input stopped.' );
		};
		recognition.onend = () => {
			setIsListening( false );
			speechRecognitionRef.current = null;
		};
		speechRecognitionRef.current = recognition;

		try {
			recognition.start();
		} catch {
			setIsListening( false );
			setVoiceStatus( 'Voice input could not start.' );
		}
	};

	const handleReadQuestion = () => {
		if ( ! canUseSpeechSynthesis ) {
			setVoiceStatus( 'Voice output is not supported in this browser.' );
			return;
		}

		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(
			new window.SpeechSynthesisUtterance(
				currentRefinementStage.question
			)
		);
		setVoiceStatus( 'Reading question aloud.' );
	};

	const referenceImagesDropdown = (
		<Dropdown
			popoverProps={ {
				placement: 'top-start',
				focusOnMount: true,
			} }
			renderToggle={ ( { isOpen: isDropdownOpen, onToggle } ) => (
				<Button
					className={ `kaigen-modal__ref-button ${
						isDropdownOpen ? 'is-primary' : ''
					} ${
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
			renderContent={ () => (
				<div className="kaigen-modal__reference-menu" role="menu">
					{ allReferenceImages.length > 0 ? (
						<div className="kaigen-modal-reference-images-container">
							{ allReferenceImages.map( ( img, index ) => {
								const imageId = getReferenceImageId( img );
								const isSelected = selectedRefs.some(
									( selected ) =>
										getReferenceImageId( selected ) ===
										imageId
								);

								return (
									<button
										type="button"
										key={ imageId || `initial-${ index }` }
										onClick={ () =>
											handleImageToggle( img )
										}
										className={ `kaigen-modal-reference-image ${
											isSelected
												? 'kaigen-modal-reference-image-selected'
												: ''
										}` }
										role="menuitemcheckbox"
										aria-checked={ isSelected }
										aria-label={
											img.alt || 'Select reference image'
										}
									>
										<img
											src={ img.thumbnail_url || img.url }
											alt={ img.alt || '' }
										/>
									</button>
								);
							} ) }
						</div>
					) : (
						<p className="kaigen-modal-no-references">
							No reference images. Mark images in the Media
							Library to use them here.
						</p>
					) }
				</div>
			) }
		/>
	);

	const aspectRatioDropdown = (
		<Dropdown
			popoverProps={ {
				placement: 'top-start',
				focusOnMount: true,
			} }
			renderToggle={ ( { isOpen: isDropdownOpen, onToggle } ) => (
				<Button
					className={ `kaigen-modal__aspect-ratio-toggle ${
						isDropdownOpen ? 'is-primary' : ''
					}` }
					onClick={ onToggle }
					aria-expanded={ isDropdownOpen }
					aria-label={ `Aspect ratio: ${ selectedAspectRatio.ratio } ${ selectedAspectRatio.label }` }
				>
					<span
						className={ `kaigen-modal-aspect-ratio-icon kaigen-aspect-ratio-${ selectedAspectRatio.value }` }
					></span>
				</Button>
			) }
			renderContent={ ( { onClose: closeDropdown } ) => (
				<div className="kaigen-modal__aspect-ratio-menu" role="menu">
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
							aria-checked={ orientation === opt.value }
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
	);

	const providerDropdown = hasProviderChoices && (
		<Dropdown
			popoverProps={ {
				placement: 'top-end',
				focusOnMount: true,
			} }
			renderToggle={ ( { isOpen: isDropdownOpen, onToggle } ) => (
				<Button
					className={ `kaigen-modal__provider-toggle ${
						isDropdownOpen ? 'is-primary' : ''
					}` }
					onClick={ onToggle }
					aria-expanded={ isDropdownOpen }
					aria-label={ `Provider: ${
						selectedProvider?.name || 'Auto'
					}` }
				>
					{ selectedProviderLogo && (
						<img
							src={ selectedProviderLogo }
							alt=""
							aria-hidden="true"
							className="kaigen-modal__provider-logo"
						/>
					) }
					<span
						className={ `kaigen-modal__provider-toggle-label ${
							selectedProviderLogo
								? 'kaigen-modal__provider-toggle-label-hidden'
								: ''
						}` }
					>
						{ selectedProvider?.name || 'Auto' }
					</span>
					<Dashicon
						icon="arrow-down-alt2"
						className="kaigen-modal__provider-toggle-icon"
					/>
				</Button>
			) }
			renderContent={ ( { onClose: closeDropdown } ) => (
				<div className="kaigen-modal__provider-menu" role="menu">
					{ availableProviders.map( ( opt ) => {
						const providerLogo = getProviderLogo( opt );

						return (
							<button
								type="button"
								key={ opt.id }
								className={ `kaigen-modal__provider-menu-item ${
									provider === opt.id
										? 'kaigen-modal__provider-menu-item-selected'
										: ''
								}` }
								onClick={ () => {
									setProvider( opt.id );
									closeDropdown();
								} }
								role="menuitemradio"
								aria-checked={ provider === opt.id }
							>
								<span className="kaigen-modal__provider-menu-icon">
									{ providerLogo && (
										<img
											src={ providerLogo }
											alt=""
											aria-hidden="true"
											className="kaigen-modal__provider-logo"
										/>
									) }
								</span>
								<span>{ opt.name }</span>
							</button>
						);
					} ) }
				</div>
			) }
		/>
	);

	const interactiveRefinementPanel = isInteractiveMode && (
		<div className="kaigen-modal__refinement-panel">
			<div
				className="kaigen-modal__refinement-stages"
				role="tablist"
				aria-label="Refinement stages"
			>
				{ REFINEMENT_STAGES.map( ( stage ) => (
					<Button
						key={ stage.id }
						className={ `kaigen-modal__refinement-stage ${
							activeRefinementStage === stage.id
								? 'is-active'
								: ''
						}` }
						role="tab"
						aria-selected={ activeRefinementStage === stage.id }
						onClick={ () => setActiveRefinementStage( stage.id ) }
					>
						{ stage.label }
					</Button>
				) ) }
			</div>

			<div className="kaigen-modal__refinement-question-row">
				<p className="kaigen-modal__refinement-question">
					{ currentRefinementStage.question }
				</p>
				<div className="kaigen-modal__voice-actions">
					<Button
						className="kaigen-modal__voice-button"
						onClick={ handleReadQuestion }
						aria-disabled={ ! canUseSpeechSynthesis }
						aria-label="Read refinement question aloud"
					>
						<Dashicon icon="controls-volumeon" />
					</Button>
					<Button
						className={ `kaigen-modal__voice-button ${
							isListening ? 'is-listening' : ''
						}` }
						onClick={ handleVoiceInput }
						aria-disabled={ ! canUseSpeechRecognition }
						aria-pressed={ isListening }
						aria-label={
							isListening
								? 'Stop voice input'
								: 'Start voice input'
						}
					>
						<Dashicon icon="microphone" />
					</Button>
				</div>
			</div>

			<div className="kaigen-modal__refinement-chips">
				{ currentRefinementStage.chips.map( ( chip ) => (
					<Button
						key={ chip.text }
						className="kaigen-modal__refinement-chip"
						onClick={ () => handleAppendPromptDetail( chip.text ) }
					>
						{ chip.label }
					</Button>
				) ) }
			</div>

			{ promptTerms.length > 0 && (
				<div
					className="kaigen-modal__prompt-terms"
					aria-label="Prompt details"
				>
					{ promptTerms.map( ( term ) => (
						<Dropdown
							key={ term.id }
							popoverProps={ {
								placement: 'top-start',
								focusOnMount: true,
							} }
							renderToggle={ ( {
								isOpen: isDropdownOpen,
								onToggle,
							} ) => (
								<Button
									className={ `kaigen-modal__term-chip ${
										isDropdownOpen ? 'is-active' : ''
									}` }
									onClick={ onToggle }
									aria-expanded={ isDropdownOpen }
								>
									{ term.text }
								</Button>
							) }
							renderContent={ ( { onClose: closeDropdown } ) => (
								<div
									className="kaigen-modal__term-menu"
									role="menu"
								>
									{ getTermExpansionChoices( term ).map(
										( choice ) => (
											<button
												type="button"
												key={ choice }
												className="kaigen-modal__term-menu-item"
												onClick={ () => {
													handleTermExpansion(
														term,
														choice
													);
													closeDropdown();
												} }
												role="menuitem"
											>
												{ choice }
											</button>
										)
									) }
								</div>
							) }
						/>
					) ) }
				</div>
			) }

			{ voiceStatus && (
				<p className="kaigen-modal__voice-status" role="status">
					{ voiceStatus }
				</p>
			) }
		</div>
	);

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

			<div
				className={ `kaigen-modal__stage ${
					generatedImage?.url ? 'has-generated-image' : ''
				}` }
			>
				{ generatedImage?.url && (
					<div className="kaigen-modal__generated-preview">
						<img
							src={ generatedImage.url }
							alt={ generatedImage.alt || '' }
						/>
					</div>
				) }

				<div className="kaigen-modal__composer">
					<div className="kaigen-modal__interactive-row">
						<Button
							className={ `kaigen-modal__interactive-toggle ${
								isInteractiveMode ? 'is-primary' : ''
							}` }
							onClick={ () =>
								setIsInteractiveMode(
									( isEnabled ) => ! isEnabled
								)
							}
							aria-pressed={ isInteractiveMode }
						>
							<Dashicon icon="format-chat" />
							<span>Interactive mode</span>
						</Button>
					</div>

					{ interactiveRefinementPanel }

					<div className="kaigen-modal__prompt-row">
						<div className="kaigen-modal__prompt-action">
							{ referenceImagesDropdown }
							{ aspectRatioDropdown }
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

						<div className="kaigen-modal__output-action">
							{ providerDropdown }
							<Button
								className="kaigen-modal__submit-button"
								variant={
									prompt.trim() ? 'primary' : undefined
								}
								onClick={ handleGenerate }
								disabled={ isLoading || ! prompt.trim() }
								aria-label="Generate Image"
							>
								<Dashicon icon="admin-appearance" />
							</Button>
						</div>
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
