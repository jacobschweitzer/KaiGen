/**
 * E2E test for KaiGen image generation with mocked API responses.
 * Tests the complete flow of generating an AI image in the block editor.
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

/**
 * Helper function to configure KaiGen provider settings via WordPress admin.
 * @param page
 */
async function configureKaiGenProvider( page: any ) {
	// Navigate to the KaiGen settings page
	await page.goto( '/wp-admin/options-general.php?page=kaigen-settings' );

	// Wait for the settings page to load
	await page.waitForSelector( '.wrap h1', { timeout: 10000 } );

	// Verify we're on the correct page
	const pageTitle = await page.locator( '.wrap h1' ).textContent();

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

		const hasOpenAI = options.some( ( option ) =>
			option.toLowerCase().includes( 'openai' )
		);

		if ( hasOpenAI ) {
			await providerSelect.selectOption( 'openai' );
			await page.waitForSelector(
				'input[name="kaigen_provider_api_keys[openai]"]',
				{
					timeout: 5000,
				}
			);
		}
	}

	// Set the API key after selecting the provider
	const apiKeyField = page.locator(
		'input[name="kaigen_provider_api_keys[openai]"]'
	);
	if ( ( await apiKeyField.count() ) > 0 ) {
		await apiKeyField.fill( 'sk-test-e2e-key-1234567890' );
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
	const tinyPngBuffer = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
		'base64'
	);

	const openKaiGenPanel = async ( page, editor ) => {
		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );
		await editor.selectBlocks( imageBlock );
		await page.waitForFunction( () => {
			return (
				( window as any ).wp.data
					.select( 'core/block-editor' )
					.getSelectedBlock()?.name === 'core/image'
			);
		} );

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
		await page.waitForFunction( () => {
			const selectedBlock = ( window as any ).wp.data
				.select( 'core/block-editor' )
				.getSelectedBlock();
			return (
				selectedBlock &&
				typeof selectedBlock.attributes?.id === 'number' &&
				selectedBlock.attributes.id > 0
			);
		} );

		await page.evaluate( () => {
			( window as any ).wp.data
				.dispatch( 'core/edit-post' )
				.openGeneralSidebar( 'edit-post/block' );
		} );
		await editor.openDocumentSettingsSidebar();
		const sidebar = page.locator(
			'.edit-post-sidebar, .interface-interface-skeleton__sidebar'
		);
		await expect( sidebar ).toBeVisible( { timeout: 10000 } );
		const blockTab = page.getByRole( 'tab', { name: 'Block' } );
		if ( ( await blockTab.count() ) > 0 ) {
			await blockTab.click();
		}
		await editor.selectBlocks( imageBlock );
		await page.waitForFunction( () => {
			return (
				( window as any ).wp.data
					.select( 'core/block-editor' )
					.getSelectedBlock()?.name === 'core/image'
			);
		} );

		await page.waitForFunction( () => {
			const sidebarEl = document.querySelector(
				'.edit-post-sidebar, .interface-interface-skeleton__sidebar'
			);
			return sidebarEl?.textContent?.includes( 'KaiGen' );
		} );

		const kaiGenPanelToggle = sidebar.getByRole( 'button', {
			name: 'KaiGen',
			exact: true,
		} );
		await expect( kaiGenPanelToggle ).toBeVisible( { timeout: 15000 } );
		const isPanelExpanded =
			await kaiGenPanelToggle.getAttribute( 'aria-expanded' );
		if ( isPanelExpanded !== 'true' ) {
			await kaiGenPanelToggle.click();
		}
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
	 * Test case for verifying image block placeholder buttons.
	 */
	test( 'should show all image source buttons in placeholder', async ( {
		editor,
		page,
	} ) => {
		// Insert the image block
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlockSelector = '[data-type="core/image"]';
		const imageBlock = editor.canvas.locator( imageBlockSelector );

		// Wait for the block to be visible
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

		// Verify the KaiGen button exists and is visible
		await expect( aiGenerateButton ).toBeVisible( { timeout: 10000 } );
		await expect( aiGenerateButton ).toBeEnabled();
	} );

	/**
	 * Test case for verifying provider data is available in editor.
	 */
	test( 'should have provider data available in editor', async ( {
		editor,
		page,
	} ) => {
		// Insert image block to trigger editor scripts
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlockSelector = '[data-type="core/image"]';
		const imageBlock = editor.canvas.locator( imageBlockSelector );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

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
		const modal = page.locator( '.components-modal__screen-overlay' );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		// Enter prompt
		const promptInput = page.locator(
			'textarea[id*="inspector-textarea-control"], .components-textarea-control__input, textarea'
		);
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
			const insertedImage = imageBlock.locator( 'img' );
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
		await page.goto( '/wp-admin/options-general.php?page=kaigen-settings' );
		await page.waitForSelector( '.wrap h1', { timeout: 10000 } );

		// Select Replicate provider
		const providerSelect = page.locator( 'select[name="kaigen_provider"]' );
		await providerSelect.selectOption( 'replicate' );
		await page.waitForSelector(
			'input[name="kaigen_provider_api_keys[replicate]"]',
			{
				timeout: 5000,
			}
		);

		// Set API key
		const apiKeyField = page.locator(
			'input[name="kaigen_provider_api_keys[replicate]"]'
		);
		await apiKeyField.fill( 'r8_test_abcdefghijklmnopqrstuvwxyz123456' );

		// Save settings
		const saveButton = page.locator(
			'input[type="submit"][value="Save Changes"]'
		);
		await saveButton.click();
		await page.waitForLoadState( 'domcontentloaded' );

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
		const modal = page.locator( '.components-modal__screen-overlay' );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		// Enter prompt
		const promptInput = page.locator(
			'textarea[id*="inspector-textarea-control"], .components-textarea-control__input, textarea'
		);
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
			const insertedImage = imageBlock.locator( 'img' );
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

		// Upload a small reference image
		const uploadButton = imageBlock.getByRole( 'button', {
			name: /upload/i,
		} );
		await expect( uploadButton ).toBeVisible( { timeout: 10000 } );
		await uploadButton.click();

		const fileInput = editor.canvas.locator( 'input[type="file"]' );
		await expect( fileInput ).toBeAttached( { timeout: 10000 } );
		await fileInput.setInputFiles( {
			name: 'reference.png',
			mimeType: 'image/png',
			buffer: tinyPngBuffer,
		} );

		const insertedImage = imageBlock.locator( 'img' );
		await expect( insertedImage ).toBeVisible( { timeout: 10000 } );

		await openKaiGenPanel( page, editor );
		const referenceCheckbox = page.getByRole( 'checkbox', {
			name: 'Reference image',
		} );
		await expect( referenceCheckbox ).toBeVisible( { timeout: 10000 } );
		if ( ! ( await referenceCheckbox.isChecked() ) ) {
			await referenceCheckbox.check();
		}

		// Open KaiGen modal from the toolbar
		await imageBlock.click();
		const kaiGenButton = page.getByRole( 'button', {
			name: 'KaiGen',
			exact: true,
		} );
		await expect( kaiGenButton.first() ).toBeVisible( { timeout: 10000 } );
		await kaiGenButton.first().click();

		// Wait for modal
		const modal = page.locator( '.components-modal__screen-overlay' );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		// Open reference images dropdown and select the reference thumbnail
		const referenceToggle = page.getByRole( 'button', {
			name: 'Reference Images',
		} );
		await expect( referenceToggle ).toBeVisible( { timeout: 5000 } );
		await referenceToggle.click();

		const referenceThumbnails = page.locator(
			'.kaigen-modal-reference-image'
		);
		await expect
			.poll( async () => referenceThumbnails.count() )
			.toBeGreaterThan( 0 );
		const selectedReference = referenceThumbnails.first();
		let selectedCount = 0;
		for ( let attempt = 0; attempt < 3; attempt++ ) {
			await selectedReference.click( { force: true } );
			try {
				await expect(
					page.locator( '.kaigen-modal-reference-image-selected' )
				).toHaveCount( 1, { timeout: 1500 } );
				selectedCount = 1;
				break;
			} catch ( error ) {
				selectedCount = await page
					.locator( '.kaigen-modal-reference-image-selected' )
					.count();
			}
		}
		expect( selectedCount ).toBeGreaterThan( 0 );

		// Enter prompt
		const promptInput = page.getByPlaceholder( 'Image prompt...' );
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

		const modal = page.locator( '.components-modal__screen-overlay' );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		const promptInput = page.locator(
			'textarea[id*="inspector-textarea-control"], .components-textarea-control__input, textarea'
		);
		await expect( promptInput ).toBeVisible( { timeout: 5000 } );
		await promptInput.fill( 'A tiny green checkmark icon' );

		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );
		await generateButton.click();

		await expect( modal ).not.toBeVisible( { timeout: 15000 } );

		const insertedImage = imageBlock.locator( 'img' );
		await expect( insertedImage ).toBeVisible( { timeout: 10000 } );

		await openKaiGenPanel( page, editor );
		const altButton = page.getByRole( 'button', {
			name: 'Generate Alt Text',
		} );
		await expect( altButton ).toBeVisible( { timeout: 10000 } );
		const initialAlt = await insertedImage.getAttribute( 'alt' );
		await altButton.click();

		const successNotice = page.locator( '.components-snackbar__content', {
			hasText: 'Alt text generated.',
		} );
		await expect( successNotice ).toBeVisible( { timeout: 15000 } );

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
		const modal = page.locator( '.components-modal__screen-overlay' );
		await expect( modal ).toBeVisible( { timeout: 10000 } );

		// Enter a prompt that might trigger content moderation (mocked)
		const promptInput = page.locator(
			'textarea[id*="inspector-textarea-control"], .components-textarea-control__input, textarea'
		);
		await expect( promptInput ).toBeVisible( { timeout: 5000 } );
		await promptInput.fill( 'TRIGGER_ERROR_RESPONSE' );

		// Click generate button
		const generateButton = page.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeVisible( { timeout: 5000 } );
		await generateButton.click();

		// Modal should still be open with error message
		await expect( modal ).toBeVisible( { timeout: 10000 } );
		const modalErrorText = modal.locator( '.kaigen-error-text' );
		await expect( modalErrorText ).toBeVisible( { timeout: 10000 } );
		await expect( modalErrorText ).not.toHaveText( '' );

		// Close modal
		const closeButton = page.locator(
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
