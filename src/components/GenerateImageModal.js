// This file contains the GenerateImageModal component - a shared modal for AI image generation.

import { useState, useEffect, useMemo } from '@wordpress/element';
import {
	Button,
	TextareaControl,
	Modal,
	Dropdown,
	Dashicon,
} from '@wordpress/components';
import { generateImage, fetchReferenceImages } from '../api';
import useGenerationProgress from '../hooks/useGenerationProgress';

const kaiGenLogo = window.kaiGen?.logoUrl;
const featureFlags = window.kaiGen?.featureFlags || {};

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
	const [ quality, setQuality ] = useState( 'medium' );
	const [ estimatedDurationMs, setEstimatedDurationMs ] = useState( null );
	const [ bestOfResults, setBestOfResults ] = useState( [] );
	const [ bestOfPrompts, setBestOfPrompts ] = useState( [] );

	const editorSettings =
		wp.data.select( 'core/editor' )?.getEditorSettings() || {};
	const provider = editorSettings.kaigen_provider || 'replicate';
	const defaultQuality = editorSettings.kaigen_quality || 'medium';
	const maxRefs = provider === 'replicate' ? 10 : 16;
	const progress = useGenerationProgress( isLoading, estimatedDurationMs );
	const isBestOfEnabled = featureFlags.bestOfImages === true;
	const isBestOfEligible =
		isBestOfEnabled && provider === 'replicate' && quality === 'low';
	const bestOfLabels = useMemo(
		() => [ 'Original', 'Detailed', 'Creative' ],
		[]
	);

	useEffect( () => {
		if ( isOpen ) {
			fetchReferenceImages().then( setReferenceImages );
			setQuality( defaultQuality );
			setBestOfResults( [] );
			setBestOfPrompts( [] );

			// Pre-select initial reference image if provided
			if ( initialReferenceImage && initialReferenceImage.url ) {
				setSelectedRefs( [ initialReferenceImage ] );
			} else {
				setSelectedRefs( [] );
			}
		}
	}, [ isOpen, initialReferenceImage, defaultQuality ] );

	useEffect( () => {
		setBestOfResults( [] );
		setBestOfPrompts( [] );
	}, [ prompt, aspectRatio, quality, provider, selectedRefs ] );

	const buildDetailedPrompt = ( basePrompt ) => {
		const detailAdditions =
			' with rich textures, cinematic lighting, sharp focus, and a cohesive color palette';
		return `${ basePrompt }${ detailAdditions }`;
	};

	const buildCreativePrompt = ( basePrompt ) => {
		const promptLower = basePrompt.toLowerCase();
		const sportsKeywords = [
			'sport',
			'sports',
			'soccer',
			'basketball',
			'football',
			'baseball',
			'tennis',
			'golf',
			'hockey',
			'running',
			'cycling',
		];
		const humorKeywords = [
			'humor',
			'humour',
			'funny',
			'comedy',
			'joke',
			'humorous',
			'silly',
			'whimsical',
		];
		const isSportsPrompt = sportsKeywords.some( ( keyword ) =>
			promptLower.includes( keyword )
		);
		const isHumorPrompt = humorKeywords.some( ( keyword ) =>
			promptLower.includes( keyword )
		);
		let creativeAddition =
			' with a playful, unexpected twist that complements the scene';

		if ( isSportsPrompt ) {
			creativeAddition =
				' with dynamic sports energy, a cheering crowd, and dramatic motion blur';
		}
		if ( isHumorPrompt ) {
			creativeAddition =
				' with a surprising comedic element, like a quirky character photobombing the scene';
		}

		return `${ basePrompt }, reimagined${ creativeAddition }`;
	};

	const buildBestOfPrompts = ( basePrompt ) => [
		basePrompt,
		buildDetailedPrompt( basePrompt ),
		buildCreativePrompt( basePrompt ),
	];

	const buildOptions = () => {
		const options = {};
		if ( selectedRefs.length > 0 ) {
			options.sourceImageUrls = selectedRefs.map( ( ref ) => ref.url );
			options.sourceImageIds = selectedRefs
				.map( ( ref ) => ref.id )
				.filter( ( id ) => Number.isInteger( id ) && id > 0 );
		}
		if ( aspectRatio ) {
			options.aspectRatio = aspectRatio;
		}
		if ( quality ) {
			options.quality = quality;
		}
		options.onEstimatedTime = ( estimatedSecondsValue ) => {
			if ( typeof estimatedSecondsValue === 'number' ) {
				setEstimatedDurationMs( estimatedSecondsValue * 1000 );
			}
		};
		return options;
	};

	const generateImagePromise = ( promptText, options ) =>
		new Promise( ( resolve ) => {
			generateImage( promptText, resolve, options );
		} );

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
		setEstimatedDurationMs( null );
		setError( null );
		setBestOfResults( [] );
		setBestOfPrompts( [] );

		const options = buildOptions();
		const basePrompt = prompt.trim();

		if ( isBestOfEligible ) {
			const prompts = buildBestOfPrompts( basePrompt );
			setBestOfPrompts( prompts );
			Promise.all(
				prompts.map( ( promptText ) =>
					generateImagePromise( promptText, options )
				)
			)
				.then( ( results ) => {
					const errors = results.filter( ( result ) => result.error );
					if ( errors.length ) {
						setError( errors[ 0 ].error );
						setIsLoading( false );
						return;
					}
					setBestOfResults( results );
					setIsLoading( false );
				} )
				.catch( () => {
					setError(
						'An unknown error occurred while generating the images'
					);
					setIsLoading( false );
				} );
			return;
		}

		generateImage(
			basePrompt,
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
		setQuality( defaultQuality );
		setEstimatedDurationMs( null );
		setBestOfResults( [] );
		setBestOfPrompts( [] );
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
														prev.length < maxRefs
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
						aria-label={
							isBestOfEligible
								? 'Generate Images'
								: 'Generate Image'
						}
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
									<button
										type="button"
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
									</button>
								) ) }
							</div>
							<h4 className="kaigen-modal-dropdown-content-title">
								Quality
							</h4>
							<div className="kaigen-modal-quality-container">
								{ [
									{ value: 'low', label: 'Low' },
									{ value: 'medium', label: 'Medium' },
									{ value: 'high', label: 'High' },
								].map( ( opt ) => (
									<button
										type="button"
										key={ opt.value }
										onClick={ () =>
											setQuality( opt.value )
										}
										aria-pressed={ quality === opt.value }
										className={ `kaigen-modal__quality-button ${
											quality === opt.value
												? 'kaigen-modal__quality-button-selected'
												: ''
										}` }
									>
										{ opt.label }
									</button>
								) ) }
							</div>
							{ isBestOfEnabled && provider === 'replicate' && (
								<p className="kaigen-modal__best-of-note">
									Best-of works with Replicate at Low quality.
								</p>
							) }
						</div>
					) }
				/>
			</div>
			{ isBestOfEligible && bestOfResults.length > 0 && (
				<div className="kaigen-modal__best-of-results">
					<p className="kaigen-modal__best-of-title">
						Pick your favorite
					</p>
					<div className="kaigen-modal__best-of-grid">
						{ bestOfResults.map( ( result, index ) => (
							<button
								type="button"
								key={ `${ result.url }-${ index }` }
								className="kaigen-modal__best-of-card"
								onClick={ () => {
									onSelect( result );
									handleClose();
								} }
							>
								<img
									src={ result.url }
									alt={ bestOfPrompts[ index ] || prompt }
								/>
								<span className="kaigen-modal__best-of-label">
									{ bestOfLabels[ index ] }
								</span>
							</button>
						) ) }
					</div>
				</div>
			) }
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
