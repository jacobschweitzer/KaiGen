/**
 * E2E test for KaiGen image generation with mocked API responses.
 * Tests the complete flow of generating an AI image in the block editor.
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

const TEST_PROVIDER_CONFIGS = {
	openai: {
		apiKey: 'sk-test-e2e-key-1234567890',
	},
	replicate: {
		apiKey: 'r8_test_abcdefghijklmnopqrstuvwxyz123456',
	},
	xai: {
		apiKey: 'xai-test-e2e-key-1234567890',
	},
};

/**
 * Gets the E2E configuration for a provider.
 *
 * @param provider
 */
function getTestProviderConfig( provider: string ) {
	const config = TEST_PROVIDER_CONFIGS[ provider ];

	if ( ! config ) {
		throw new Error(
			`No E2E provider configuration found for "${ provider }".`
		);
	}

	return config;
}

/**
 * Opens the KaiGen settings page, retrying if Playground is briefly in maintenance mode.
 * @param page
 */
async function openKaiGenSettings( page: any ) {
	for ( let attempt = 0; attempt < 3; attempt++ ) {
		await page.goto( '/wp-admin/options-general.php?page=kaigen-settings' );
		await page.waitForLoadState( 'domcontentloaded' );

		const maintenanceMessage = page.getByText(
			'Briefly unavailable for scheduled maintenance. Check back in a minute.'
		);
		const maintenanceVisible = await maintenanceMessage
			.isVisible( { timeout: 2000 } )
			.catch( () => false );

		const databaseErrorHeading = page.getByRole( 'heading', {
			name: 'Error establishing a database connection',
		} );
		const databaseErrorVisible = await databaseErrorHeading
			.isVisible( { timeout: 2000 } )
			.catch( () => false );

		if ( maintenanceVisible || databaseErrorVisible ) {
			await page.waitForTimeout( 2000 );
			continue;
		}

		const pageTitle = page.locator( '.wrap h1' );
		const titleVisible = await pageTitle
			.isVisible( { timeout: 10000 } )
			.catch( () => false );
		if ( titleVisible ) {
			return pageTitle;
		}

		await page.waitForTimeout( 2000 );
	}

	throw new Error(
		'KaiGen settings page did not become available after retries.'
	);
}

/**
 * Helper function to configure KaiGen provider settings via WordPress admin.
 * @param page
 * @param provider
 */
async function configureKaiGenProvider( page: any, provider = 'openai' ) {
	const providerConfig = getTestProviderConfig( provider );

	// Navigate to the KaiGen settings page
	const pageTitleLocator = await openKaiGenSettings( page );

	// Verify we're on the correct page
	const pageTitle = await pageTitleLocator.textContent();

	if ( pageTitle !== 'KaiGen Settings' ) {
		throw new Error(
			`Expected "KaiGen Settings" but got "${ pageTitle }"`
		);
	}

	// Select the provider first
	const providerSelect = page.locator( 'select[name="kaigen_provider"]' );
	if ( ( await providerSelect.count() ) > 0 ) {
		const options = await providerSelect
			.locator( 'option' )
			.allTextContents();

		const hasProvider = options.some( ( option ) =>
			option.toLowerCase().includes( provider.toLowerCase() )
		);

		if ( hasProvider ) {
			await providerSelect.selectOption( provider );
			await page.waitForSelector(
				`input[name="kaigen_provider_api_keys[${ provider }]"]`,
				{
					timeout: 5000,
				}
			);
		}
	}

	// Set the API key after selecting the provider
	const apiKeyField = page.locator(
		`input[name="kaigen_provider_api_keys[${ provider }]"]`
	);
	if ( ( await apiKeyField.count() ) > 0 ) {
		await apiKeyField.fill( providerConfig.apiKey );
	}

	// Set quality settings
	const qualitySelect = page.locator(
		'select[name="kaigen_quality_settings[quality]"]'
	);
	if ( ( await qualitySelect.count() ) > 0 ) {
		await qualitySelect.selectOption( 'medium' );
	}

	// Save all settings at once
	const saveButton = page.locator(
		'input[type="submit"][value="Save Changes"], button[type="submit"]'
	);
	if ( ( await saveButton.count() ) > 0 ) {
		await saveButton.click();

		await page.waitForLoadState( 'domcontentloaded' );
	}
}

test.describe( 'KaiGen Image Generation', () => {
	const getKaiGenModal = ( page ) => page.locator( '.kaigen-modal' ).first();
	const getKaiGenToolbarButton = ( page ) =>
		page
			.locator( 'button' )
			.filter( { has: page.locator( 'img.kaigen-toolbar-icon' ) } )
			.first();
	const getModalPromptInput = ( modal ) =>
		modal.getByPlaceholder( 'Image prompt...' );
	const getInsertedImage = ( imageBlock ) =>
		imageBlock.locator( 'img[src*="/wp-content/uploads/"]' ).first();
	const openKaiGenImageMenuModal = async (
		page,
		editor,
		imageBlock,
		buttonName
	) => {
		await imageBlock.click();
		await editor.selectBlocks( imageBlock );

		const addImageButton = page
			.getByRole( 'button', {
				name: buttonName,
			} )
			.first();
		await expect( addImageButton ).toBeVisible( { timeout: 10000 } );
		await addImageButton.click();

		const aiGenerateMenuItem = page.getByRole( 'menuitem', {
			name: /^KaiGen$/,
		} );
		await expect( aiGenerateMenuItem ).toHaveCount( 1 );
		await expect( aiGenerateMenuItem ).toBeVisible();
		await aiGenerateMenuItem.click();

		await expect( aiGenerateMenuItem ).not.toBeVisible( {
			timeout: 5000,
		} );

		const modal = getKaiGenModal( page );
		await expect( modal ).toBeVisible( { timeout: 10000 } );
		return modal;
	};
	const openKaiGenAddImageMenuModal = async ( page, editor, imageBlock ) =>
		openKaiGenImageMenuModal( page, editor, imageBlock, /add image/i );
	const openKaiGenReplaceMenuModal = async ( page, editor, imageBlock ) =>
		openKaiGenImageMenuModal( page, editor, imageBlock, /replace/i );
	const recoverEditorConnection = async ( page ) => {
		const connectionLostDialog = page
			.locator( '.components-modal__screen-overlay' )
			.filter( { hasText: 'Connection lost' } )
			.first();

		for ( let attempt = 0; attempt < 3; attempt++ ) {
			const isConnectionLost = await connectionLostDialog
				.isVisible( { timeout: 1000 } )
				.catch( () => false );
			if ( ! isConnectionLost ) {
				return;
			}

			const retryButton = connectionLostDialog.getByRole( 'button', {
				name: 'Retry',
			} );
			const hasRetryButton = await retryButton
				.isVisible( { timeout: 1000 } )
				.catch( () => false );

			if ( hasRetryButton ) {
				await retryButton.click( { force: true } );
			}

			await connectionLostDialog
				.waitFor( { state: 'hidden', timeout: 10000 } )
				.catch( () => {} );
			await page.waitForTimeout( 500 );
		}
	};
	const openKaiGenImageBlockModal = async ( page, editor, imageBlock ) => {
		const placeholderButton = imageBlock.locator(
			'.kaigen-placeholder-button'
		);
		const hasPlaceholderButton = await placeholderButton
			.isVisible( { timeout: 1000 } )
			.catch( () => false );

		if ( hasPlaceholderButton ) {
			await placeholderButton.click();
		} else {
			for ( let attempt = 0; attempt < 3; attempt++ ) {
				await editor.selectBlocks( imageBlock );

				const toolbarButton = getKaiGenToolbarButton( page );
				const hasToolbarButton = await toolbarButton
					.isVisible( { timeout: 3000 } )
					.catch( () => false );

				if ( hasToolbarButton ) {
					await toolbarButton.evaluate(
						( button: HTMLButtonElement ) => button.click()
					);
					const modal = getKaiGenModal( page );
					await expect( modal ).toBeVisible( {
						timeout: 10000,
					} );
					return modal;
				}

				await page.waitForTimeout( 500 );
			}
		}

		const modal = getKaiGenModal( page );
		await expect( modal ).toBeVisible( { timeout: 10000 } );
		return modal;
	};
	const getSelectedImageAttachmentId = async ( page, editor, imageBlock ) => {
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );
		await imageBlock.click();
		await imageBlock.click();
		await editor.selectBlocks( imageBlock );
		const imageBlockHandle = await page.waitForFunction( () => {
			const selectedBlock = ( window as any ).wp.data
				.select( 'core/block-editor' )
				.getSelectedBlock();
			const attachmentId = Number( selectedBlock?.attributes?.id );
			if ( ! selectedBlock?.clientId || ! attachmentId ) {
				return false;
			}
			return {
				clientId: selectedBlock.clientId,
				attachmentId,
			};
		} );
		const { clientId, attachmentId } = await imageBlockHandle.jsonValue();
		await page.evaluate(
			( { id, attachment } ) => {
				( window as any ).wp.data
					.dispatch( 'core/block-editor' )
					.updateBlockAttributes( id, {
						id: Number( attachment ),
					} );
			},
			{ id: clientId, attachment: attachmentId }
		);
		return attachmentId;
	};
	/**
	 * Configure provider once before all tests
	 */
	test.beforeAll( async ( { browser } ) => {
		const context = await browser.newContext();
		const page = await context.newPage();

		// Navigate to admin and wait for it to be ready
		await page.goto( '/wp-admin/' );
		await page.waitForLoadState( 'domcontentloaded' );

		// Configure KaiGen settings
		await configureKaiGenProvider( page );

		await context.close();
	} );

	test.beforeEach( async ( { admin, page } ) => {
		test.setTimeout( 60000 );
		await admin.createNewPost( { showWelcomeGuide: false } );
		if (
			! page.url().includes( 'post-new.php' ) &&
			! page.url().includes( 'post.php' )
		) {
			await page.goto( '/wp-admin/post-new.php' );
		}
		await page.waitForURL( /post-new\.php|post\.php/ );
		await page.waitForLoadState( 'domcontentloaded' );
		await page.waitForSelector( '.edit-post-layout, .block-editor', {
			timeout: 15000,
			state: 'attached',
		} );
	} );

	/**
	 * Test case for verifying image block placeholder buttons and provider data.
	 */
	test( 'should show placeholder buttons and provider data', async ( {
		editor,
		page,
	} ) => {
		// Insert the image block to trigger editor scripts
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlockSelector = '[data-type="core/image"]';
		const imageBlock = editor.canvas.locator( imageBlockSelector );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		// Verify the media placeholder is visible
		const mediaPlaceholder = imageBlock.locator(
			'.components-placeholder'
		);
		await expect( mediaPlaceholder ).toBeVisible();

		// Check for Upload button
		const uploadButton = imageBlock.getByRole( 'button', {
			name: /upload/i,
		} );
		await expect( uploadButton ).toBeVisible();

		// Check for Media Library button
		const mediaLibraryButton = imageBlock.getByRole( 'button', {
			name: /media library/i,
		} );
		await expect( mediaLibraryButton ).toBeVisible();

		// Check for Insert from URL button
		const insertFromURLButton = imageBlock.getByRole( 'button', {
			name: /insert from url/i,
		} );
		await expect( insertFromURLButton ).toBeVisible();

		// Look for the KaiGen placeholder button (updated selector)
		const aiGenerateButton = editor.canvas.locator(
			'.kaigen-placeholder-button'
		);

		// Verify the KaiGen button exists once and is visible.
		await expect( aiGenerateButton ).toHaveCount( 1 );
		await expect( aiGenerateButton ).toBeVisible( { timeout: 10000 } );
		await expect( aiGenerateButton ).toBeEnabled();

		await page.waitForFunction( () => {
			return !! ( window as any ).kaiGen;
		} );

		// Check if kaiGen object is available
		const kaiGenData = await page.evaluate( () => {
			return ( window as any ).kaiGen || null;
		} );

		// Verify that kaiGen data exists and has provider
		expect( kaiGenData ).toBeTruthy();
		expect( kaiGenData ).toHaveProperty( 'provider' );
		expect( kaiGenData.provider ).toBe( 'openai' );
	} );

	/**
	 * Test image generation through the image block Add image dropdown.
	 */
	test( 'should generate and insert image from Add image KaiGen menu item', async ( {
		editor,
		page,
	} ) => {
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenAddImageMenuModal(
			page,
			editor,
			imageBlock
		);

		const promptInput = getModalPromptInput( modal );
		await expect( promptInput ).toBeVisible( { timeout: 5000 } );
		await promptInput.fill( 'A red kite flying over a beach' );

		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );
		await generateButton.click();

		await expect(
			page.locator( '.kaigen-modal__progress [role="progressbar"]' )
		).toBeVisible( { timeout: 5000 } );
		await expect( modal ).not.toBeVisible( { timeout: 15000 } );

		const insertedImage = getInsertedImage( imageBlock );
		await expect( insertedImage ).toBeVisible( { timeout: 10000 } );

		const imageSrc = await insertedImage.getAttribute( 'src' );
		expect( imageSrc ).toBeTruthy();

		await expect
			.poll(
				async () =>
					page.evaluate( () => {
						const selectedBlock = ( window as any ).wp.data
							.select( 'core/block-editor' )
							.getSelectedBlock();

						return (
							Number( selectedBlock?.attributes?.id ) > 0 &&
							( selectedBlock?.attributes?.url || '' ).includes(
								'/wp-content/uploads/'
							)
						);
					} ),
				{ timeout: 10000 }
			)
			.toBe( true );
	} );

	/**
	 * Test image generation through the image block Replace dropdown.
	 */
	test( 'should show KaiGen in Replace menu for existing image block', async ( {
		editor,
		page,
	} ) => {
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const initialModal = await openKaiGenAddImageMenuModal(
			page,
			editor,
			imageBlock
		);
		const initialPromptInput = getModalPromptInput( initialModal );
		await expect( initialPromptInput ).toBeVisible( { timeout: 5000 } );
		await initialPromptInput.fill( 'A small red square icon' );

		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );
		await generateButton.click();

		await expect( initialModal ).not.toBeVisible( { timeout: 15000 } );

		const insertedImage = getInsertedImage( imageBlock );
		await expect( insertedImage ).toBeVisible( { timeout: 10000 } );

		const replaceModal = await openKaiGenReplaceMenuModal(
			page,
			editor,
			imageBlock
		);
		await expect( getModalPromptInput( replaceModal ) ).toBeVisible( {
			timeout: 5000,
		} );

		const referenceToggle = replaceModal.getByRole( 'button', {
			name: 'Reference Images',
		} );
		await expect( referenceToggle ).toBeVisible( { timeout: 5000 } );
		await referenceToggle.evaluate( ( button: HTMLButtonElement ) =>
			button.click()
		);

		await expect(
			page.locator( '.kaigen-modal-reference-image-selected' )
		).toHaveCount( 1, { timeout: 5000 } );
	} );

	/**
	 * Test successful image generation with OpenAI provider
	 */
	test( 'should generate image successfully with OpenAI', async ( {
		editor,
		page,
	} ) => {
		// Check for a Content Security Policy
		const csp = await page.evaluate( () => {
			const meta = document.querySelector(
				'meta[http-equiv="Content-Security-Policy"]'
			);
			return meta
				? meta.getAttribute( 'content' )
				: 'No CSP meta tag found.';
		} );

		// Insert image block
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		// Click KaiGen button (updated selector)
		const kaiGenButton = editor.canvas.locator(
			'.kaigen-placeholder-button'
		);
		await expect( kaiGenButton ).toBeVisible( { timeout: 10000 } );
		await kaiGenButton.click();

		// Wait for modal
		const modal = getKaiGenModal( page );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		// Enter prompt
		const promptInput = getModalPromptInput( modal );
		await expect( promptInput ).toBeVisible( { timeout: 5000 } );
		await promptInput.fill( 'A beautiful sunset over mountains' );

		// Click generate button
		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );

		await generateButton.click();

		// Wait for generation to start (progress bar should appear)
		await expect(
			page.locator( '.kaigen-modal__progress [role="progressbar"]' )
		).toBeVisible( { timeout: 5000 } );

		// Wait for generation to complete (mocked response should be quick)
		// Check for either success (modal closes) or error message
		try {
			// Wait for modal to close (indicating success)
			await expect( modal ).not.toBeVisible( { timeout: 15000 } );

			// Verify image was inserted
			const insertedImage = getInsertedImage( imageBlock );
			await expect( insertedImage ).toBeVisible( { timeout: 10000 } );

			// Get the image src
			const imageSrc = await insertedImage.getAttribute( 'src' );
			expect( imageSrc ).toBeTruthy();

			// Wait for the image to be fully loaded and rendered before taking screenshots
			await insertedImage.evaluate( ( image ) => {
				const img = image as HTMLImageElement;
				if ( img.complete && img.naturalWidth > 0 ) {
					return;
				}
				return new Promise( ( resolve, reject ) => {
					img.addEventListener( 'load', resolve );
					img.addEventListener( 'error', () =>
						reject( new Error( 'Image failed to load' ) )
					);
				} );
			} );

			// Take a screenshot of the full editor for context
			if ( ! process.env.CI ) {
				await page.screenshot( {
					path: 'tests/test-results/full-editor-openai.png',
					fullPage: true,
				} );
			}

			// Take a screenshot of just the image block
			if ( ! process.env.CI ) {
				await insertedImage.screenshot( {
					path: 'tests/test-results/generated-image-openai.png',
				} );
			}
		} catch ( error ) {
			// If modal didn't close, check for error messages
			if ( await modal.isVisible() ) {
				const errorText = await modal.textContent();
			}

			// Check if it's the offline error
			const pageContent = await page.textContent( 'body' );
			if ( pageContent?.includes( 'offline' ) ) {
				test.skip(
					true,
					'Test environment appears to be offline - HTTP mock may not be working'
				);
			} else {
				// Re-throw the original error for other failures
				throw error;
			}
		}
	} );

	/**
	 * Test image generation with Replicate provider
	 */
	test( 'should generate image successfully with Replicate', async ( {
		editor,
		page,
		admin,
	} ) => {
		// First, change provider to Replicate
		await configureKaiGenProvider( page, 'replicate' );

		// Create new post
		await admin.createNewPost();

		// Insert image block
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		// Click KaiGen button (updated selector)
		const kaiGenButton = editor.canvas.locator(
			'.kaigen-placeholder-button'
		);
		await expect( kaiGenButton ).toBeVisible( { timeout: 10000 } );
		await kaiGenButton.click();

		// Wait for modal
		const modal = getKaiGenModal( page );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		// Enter prompt
		const promptInput = getModalPromptInput( modal );
		await expect( promptInput ).toBeVisible( { timeout: 5000 } );
		await promptInput.fill( 'A futuristic cityscape at night' );

		// Click generate button
		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );
		await generateButton.click();

		// Wait for generation to start
		await expect(
			page.locator( '.kaigen-modal__progress [role="progressbar"]' )
		).toBeVisible( { timeout: 5000 } );

		// Wait for generation to complete
		try {
			await expect( modal ).not.toBeVisible( { timeout: 15000 } );

			// Verify image was inserted
			const insertedImage = getInsertedImage( imageBlock );
			await expect( insertedImage ).toBeVisible( { timeout: 10000 } );

			// Get the image src
			const imageSrc = await insertedImage.getAttribute( 'src' );
			expect( imageSrc ).toBeTruthy();

			// Wait for the image to be fully loaded and rendered
			await insertedImage.evaluate( ( image ) => {
				const img = image as HTMLImageElement;
				if ( img.complete && img.naturalWidth > 0 ) {
					return;
				}
				return new Promise( ( resolve, reject ) => {
					img.addEventListener( 'load', resolve );
					img.addEventListener( 'error', () =>
						reject( new Error( 'Image failed to load' ) )
					);
				} );
			} );

			// Take a screenshot of the full editor for context
			if ( ! process.env.CI ) {
				await page.screenshot( {
					path: 'tests/test-results/full-editor-replicate.png',
					fullPage: true,
				} );
			}

			// Take a screenshot of just the image block
			if ( ! process.env.CI ) {
				await insertedImage.screenshot( {
					path: 'tests/test-results/generated-image-replicate.png',
				} );
			}
		} catch ( error ) {
			// If modal didn't close, check for error messages
			if ( await modal.isVisible() ) {
				const errorText = await modal.textContent();
				// Error text available for debugging if needed
			}

			// Check if it's the offline error
			const pageContent = await page.textContent( 'body' );
			if ( pageContent?.includes( 'offline' ) ) {
				test.skip(
					true,
					'Test environment appears to be offline - HTTP mock may not be working'
				);
			} else {
				throw error;
			}
		}
	} );

	/**
	 * Test image generation with a reference image.
	 */
	test( 'should generate image with reference thumbnails in settings', async ( {
		editor,
		page,
	} ) => {
		// Insert image block
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		// Generate an initial image so the image-block toolbar path can reopen the modal
		// with the current image preselected as a reference.
		const initialModal = await openKaiGenImageBlockModal(
			page,
			editor,
			imageBlock
		);
		const initialPromptInput = getModalPromptInput( initialModal );
		await expect( initialPromptInput ).toBeVisible( { timeout: 5000 } );
		await initialPromptInput.fill( 'A tiny green checkmark icon' );

		const initialGenerateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( initialGenerateButton ).toBeVisible( {
			timeout: 5000,
		} );
		await initialGenerateButton.click();

		await expect( initialModal ).not.toBeVisible( { timeout: 15000 } );

		const insertedImage = getInsertedImage( imageBlock );
		await expect( insertedImage ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenImageBlockModal(
			page,
			editor,
			imageBlock
		);

		// Open reference images dropdown and verify the current image is preselected.
		const referenceToggle = modal.getByRole( 'button', {
			name: 'Reference Images',
		} );
		await expect( referenceToggle ).toBeVisible( { timeout: 5000 } );
		await referenceToggle.evaluate( ( button: HTMLButtonElement ) =>
			button.click()
		);

		const referenceThumbnails = page.locator(
			'.kaigen-modal-reference-image'
		);
		await expect( referenceThumbnails.first() ).toBeVisible( {
			timeout: 5000,
		} );
		await expect(
			page.locator( '.kaigen-modal-reference-image-selected' )
		).toHaveCount( 1, { timeout: 5000 } );

		// Enter prompt
		const promptInput = getModalPromptInput( modal );
		await expect( promptInput ).toBeVisible( { timeout: 5000 } );
		await promptInput.fill( 'A cinematic forest scene' );

		// Click generate button
		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );
		await generateButton.click();

		// Wait for generation to start
		await expect(
			page.locator( '.kaigen-modal__progress [role="progressbar"]' )
		).toBeVisible( { timeout: 5000 } );

		// Wait for generation to complete
		await expect( modal ).not.toBeVisible( { timeout: 15000 } );

		// Reference selection should be reflected in the modal before generation.
	} );

	/**
	 * Test alt text generation for an uploaded image.
	 */
	test( 'should generate alt text for an uploaded image', async ( {
		admin,
		editor,
		page,
	} ) => {
		await configureKaiGenProvider( page );
		await admin.createNewPost( { showWelcomeGuide: false } );

		// Insert image block
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		// Generate an image via KaiGen so the block has a valid attachment ID.
		const kaiGenButton = editor.canvas.locator(
			'.kaigen-placeholder-button'
		);
		await expect( kaiGenButton ).toBeVisible( { timeout: 10000 } );
		await kaiGenButton.click();

		const modal = getKaiGenModal( page );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		const promptInput = getModalPromptInput( modal );
		await expect( promptInput ).toBeVisible( { timeout: 5000 } );
		await promptInput.fill( 'A tiny green checkmark icon' );

		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );
		await generateButton.click();

		await expect( modal ).not.toBeVisible( { timeout: 15000 } );

		const insertedImage = getInsertedImage( imageBlock );
		await expect( insertedImage ).toBeVisible( { timeout: 10000 } );

		const attachmentId = await getSelectedImageAttachmentId(
			page,
			editor,
			imageBlock
		);
		const initialAlt = await insertedImage.getAttribute( 'alt' );
		await page.evaluate(
			async ( { id, prompt } ) => {
				const response = await ( window as any ).wp.apiFetch( {
					path: '/kaigen/v1/generate-alt-text',
					method: 'POST',
					data: {
						prompt,
						provider: 'openai',
						attachment_id: id,
					},
				} );
				const altText = response?.alt_text || '';
				if ( ! altText ) {
					throw new Error( 'Alt text response was empty.' );
				}

				await ( window as any ).wp.apiFetch( {
					path: `/wp/v2/media/${ id }`,
					method: 'POST',
					data: {
						alt_text: altText,
					},
				} );

				const selectedBlock = ( window as any ).wp.data
					.select( 'core/block-editor' )
					.getSelectedBlock();
				if ( selectedBlock?.clientId ) {
					( window as any ).wp.data
						.dispatch( 'core/block-editor' )
						.updateBlockAttributes( selectedBlock.clientId, {
							alt: altText,
						} );
				}
			},
			{
				id: attachmentId,
				prompt: 'A tiny green checkmark icon',
			}
		);

		await expect
			.poll( async () => insertedImage.getAttribute( 'alt' ), {
				timeout: 15000,
			} )
			.toBe( 'A tiny test image with a simple green checkmark icon.' );
		expect( initialAlt ).not.toBe(
			'A tiny test image with a simple green checkmark icon.'
		);
	} );

	/**
	 * Test alt text generation for an uploaded image using xAI.
	 */
	test( 'should generate alt text for an uploaded image with xAI', async ( {
		admin,
		editor,
		page,
	} ) => {
		await configureKaiGenProvider( page, 'xai' );
		await admin.createNewPost( { showWelcomeGuide: false } );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const kaiGenButton = editor.canvas.locator(
			'.kaigen-placeholder-button'
		);
		await expect( kaiGenButton ).toBeVisible( { timeout: 10000 } );
		await kaiGenButton.click();

		const modal = getKaiGenModal( page );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		const promptInput = getModalPromptInput( modal );
		await expect( promptInput ).toBeVisible( { timeout: 5000 } );
		await promptInput.fill( 'A tiny green checkmark icon' );

		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );
		await generateButton.click();

		await expect( modal ).not.toBeVisible( { timeout: 15000 } );

		const insertedImage = getInsertedImage( imageBlock );
		await expect( insertedImage ).toBeVisible( { timeout: 10000 } );

		const attachmentId = await getSelectedImageAttachmentId(
			page,
			editor,
			imageBlock
		);
		await page.evaluate(
			async ( { id, prompt } ) => {
				const response = await ( window as any ).wp.apiFetch( {
					path: '/kaigen/v1/generate-alt-text',
					method: 'POST',
					data: {
						prompt,
						provider: 'xai',
						attachment_id: id,
					},
				} );
				const altText = response?.alt_text || '';
				if ( ! altText ) {
					throw new Error( 'Alt text response was empty.' );
				}

				await ( window as any ).wp.apiFetch( {
					path: `/wp/v2/media/${ id }`,
					method: 'POST',
					data: {
						alt_text: altText,
					},
				} );

				const selectedBlock = ( window as any ).wp.data
					.select( 'core/block-editor' )
					.getSelectedBlock();
				if ( selectedBlock?.clientId ) {
					( window as any ).wp.data
						.dispatch( 'core/block-editor' )
						.updateBlockAttributes( selectedBlock.clientId, {
							alt: altText,
						} );
				}
			},
			{
				id: attachmentId,
				prompt: 'A tiny green checkmark icon',
			}
		);

		await expect
			.poll( async () => insertedImage.getAttribute( 'alt' ), {
				timeout: 15000,
			} )
			.toBe( 'A tiny test image with a simple green checkmark icon.' );
	} );

	/**
	 * Test error handling for failed generation
	 */
	test( 'should handle generation errors gracefully', async ( {
		editor,
		page,
	} ) => {
		// Insert image block
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		// Click KaiGen button (updated selector)
		const kaiGenButton = editor.canvas.locator(
			'.kaigen-placeholder-button'
		);
		await expect( kaiGenButton ).toBeVisible( { timeout: 10000 } );
		await kaiGenButton.click();

		// Wait for modal
		const modal = getKaiGenModal( page );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		// Enter a prompt that might trigger content moderation (mocked)
		const promptInput = getModalPromptInput( modal );
		await expect( promptInput ).toBeVisible( { timeout: 5000 } );
		await promptInput.fill( 'TRIGGER_ERROR_RESPONSE' );

		// Click generate button
		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );
		await generateButton.click();

		// Modal should still be open with error message
		await recoverEditorConnection( page );
		await expect( modal ).toBeVisible( { timeout: 10000 } );
		await expect
			.poll(
				async () => {
					const modalText = ( await modal.textContent() ) || '';
					return modalText.replace( /\s+/g, ' ' ).trim();
				},
				{ timeout: 10000 }
			)
			.toMatch( /rejected|safety|failed|error/i );

		// Close modal
		const closeButton = modal.locator(
			'.components-modal__header button[aria-label*="Close" i]'
		);
		if ( ( await closeButton.count() ) > 0 ) {
			await closeButton.click();
		} else {
			await page.keyboard.press( 'Escape' );
		}

		await expect( modal ).not.toBeVisible( { timeout: 5000 } );
	} );
} );
