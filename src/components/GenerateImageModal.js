// This file contains the GenerateImageModal component - a shared modal for AI image generation.

import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import {
	Button,
	TextareaControl,
	Modal,
	Dropdown,
	Dashicon,
	Spinner,
} from '@wordpress/components';
import {
	applyPromptRefinement,
	fetchPromptRefinements,
	fetchReferenceImages,
	generateImage,
} from '../api';
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

const getPromptRefinementChoiceKey = ( term, choice ) =>
	`${ term?.id || term?.text || 'term' }:${ choice }`;

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
	const [ promptRefinements, setPromptRefinements ] = useState( [] );
	const [ isLoadingPromptRefinements, setIsLoadingPromptRefinements ] =
		useState( false );
	const [ promptRefinementError, setPromptRefinementError ] =
		useState( null );
	const [ applyingPromptRefinementKey, setApplyingPromptRefinementKey ] =
		useState( null );
	const textareaContainerRef = useRef( null );
	const lastRefinementPromptRef = useRef( '' );
	const refinementRequestRef = useRef( 0 );
	const promptRefinementCountRef = useRef( 0 );
	const shouldRefreshPromptRefinementsRef = useRef( false );

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
		promptRefinementCountRef.current = promptRefinements.length;
	}, [ promptRefinements ] );

	useEffect( () => {
		if ( isOpen ) {
			fetchReferenceImages().then( setReferenceImages );
			setProvider( kaiGenSettings.provider || 'auto' );
			setOrientation( kaiGenSettings.orientation || 'square' );
			setGeneratedImage(
				initialReferenceImage?.url ? initialReferenceImage : null
			);
			setPromptRefinements( [] );
			setPromptRefinementError( null );
			setIsLoadingPromptRefinements( false );
			setApplyingPromptRefinementKey( null );
			lastRefinementPromptRef.current = '';
			refinementRequestRef.current += 1;

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
	 * Loads model-generated refinement choices for the current prompt.
	 *
	 * @param {string} [promptToRefine] Prompt text to refine.
	 * @return {Promise<void>}
	 */
	const loadPromptRefinements = useCallback(
		async ( promptToRefine = prompt ) => {
			const currentPrompt = promptToRefine;

			if ( ! currentPrompt.trim() ) {
				setPromptRefinements( [] );
				return;
			}

			if (
				lastRefinementPromptRef.current === currentPrompt &&
				promptRefinementCountRef.current > 0
			) {
				return;
			}

			const requestId = refinementRequestRef.current + 1;
			refinementRequestRef.current = requestId;
			setIsLoadingPromptRefinements( true );
			setPromptRefinementError( null );

			try {
				const refinements =
					await fetchPromptRefinements( currentPrompt );

				if ( refinementRequestRef.current !== requestId ) {
					return;
				}

				setPromptRefinements( refinements );
				lastRefinementPromptRef.current = currentPrompt;
			} catch ( refinementError ) {
				if ( refinementRequestRef.current !== requestId ) {
					return;
				}

				setPromptRefinements( [] );
				setPromptRefinementError(
					refinementError.message ||
						'Unable to load prompt refinement choices.'
				);
			} finally {
				if ( refinementRequestRef.current === requestId ) {
					setIsLoadingPromptRefinements( false );
				}
			}
		},
		[ prompt ]
	);

	useEffect( () => {
		setPromptRefinements( [] );
		setPromptRefinementError( null );
		setIsLoadingPromptRefinements( false );
		setApplyingPromptRefinementKey( null );
		lastRefinementPromptRef.current = '';
		refinementRequestRef.current += 1;

		if ( shouldRefreshPromptRefinementsRef.current ) {
			shouldRefreshPromptRefinementsRef.current = false;
			loadPromptRefinements( prompt );
		}
	}, [ loadPromptRefinements, prompt ] );

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
		setPromptRefinements( [] );
		setPromptRefinementError( null );
		setIsLoadingPromptRefinements( false );
		lastRefinementPromptRef.current = '';
		refinementRequestRef.current += 1;
		onClose();
	};

	if ( ! isOpen || ! isKaiGenAvailable() ) {
		return null;
	}

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

	const handleTermExpansion = async ( term, choice ) => {
		const promptAtSelection = prompt;
		const refinementChoiceKey = getPromptRefinementChoiceKey(
			term,
			choice
		);

		setApplyingPromptRefinementKey( refinementChoiceKey );

		try {
			const nextPrompt = await applyPromptRefinement(
				promptAtSelection,
				term,
				choice
			);

			setPrompt( ( currentPrompt ) => {
				if ( currentPrompt !== promptAtSelection ) {
					return currentPrompt;
				}

				if ( nextPrompt !== currentPrompt ) {
					shouldRefreshPromptRefinementsRef.current = true;
				}

				return nextPrompt;
			} );
		} finally {
			setApplyingPromptRefinementKey( ( currentKey ) =>
				currentKey === refinementChoiceKey ? null : currentKey
			);
		}
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

	const interactiveRefinementDropdown = (
		<Dropdown
			popoverProps={ {
				placement: 'top-start',
				focusOnMount: true,
			} }
			renderToggle={ ( { isOpen: isDropdownOpen, onToggle } ) => (
				<Button
					className={ `kaigen-modal__interactive-toggle ${
						isDropdownOpen ? 'is-primary' : ''
					}` }
					onClick={ () => {
						if ( ! isDropdownOpen ) {
							loadPromptRefinements();
						}
						onToggle();
					} }
					aria-expanded={ isDropdownOpen }
					aria-label="Interactive mode"
				>
					<Dashicon icon="format-chat" />
				</Button>
			) }
			renderContent={ () => (
				<div className="kaigen-modal__refinement-menu" role="menu">
					<div
						className="kaigen-modal__prompt-terms"
						aria-label="Prompt details"
						aria-busy={ isLoadingPromptRefinements }
					>
						{ isLoadingPromptRefinements && (
							<span
								className="kaigen-modal__loading-status"
								role="status"
								aria-label="Loading prompt details"
							>
								<Spinner />
								<span className="screen-reader-text">
									Loading prompt details
								</span>
							</span>
						) }
						{ promptRefinementError && (
							<span className="screen-reader-text" role="status">
								{ promptRefinementError }
							</span>
						) }
						{ promptRefinements.map( ( term ) => (
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
								renderContent={ ( {
									onClose: closeDropdown,
								} ) => (
									<div
										className="kaigen-modal__term-menu"
										role="menu"
									>
										{ term.choices.map( ( choice ) => {
											const choiceKey =
												getPromptRefinementChoiceKey(
													term,
													choice
												);
											const isApplyingChoice =
												applyingPromptRefinementKey ===
												choiceKey;

											return (
												<button
													type="button"
													key={ choice }
													className="kaigen-modal__term-menu-item"
													disabled={ Boolean(
														applyingPromptRefinementKey
													) }
													onClick={ async () => {
														await handleTermExpansion(
															term,
															choice
														);
														closeDropdown();
													} }
													role="menuitem"
													aria-busy={
														isApplyingChoice
													}
												>
													<span>{ choice }</span>
													{ isApplyingChoice && (
														<Spinner className="kaigen-modal__term-menu-item-spinner" />
													) }
												</button>
											);
										} ) }
									</div>
								) }
							/>
						) ) }
					</div>
				</div>
			) }
		/>
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
					<div className="kaigen-modal__prompt-row">
						<div className="kaigen-modal__prompt-action">
							{ interactiveRefinementDropdown }
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
