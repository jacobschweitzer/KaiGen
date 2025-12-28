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

			// Wait a moment for the API key field to become available
			await page.waitForTimeout( 500 );
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

		try {
			await page.waitForSelector( '.notice-success, .updated', {
				timeout: 5000,
			} );
		} catch ( error ) {
			// Continue even if no notice appears
		}

		await page.waitForTimeout( 1000 );
	}
}

test.describe( 'KaiGen Image Generation', () => {
	const tinyPngBuffer = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
		'base64'
	);
	/**
	 * Configure provider once before all tests
	 */
	test.beforeAll( async ( { browser } ) => {
		const context = await browser.newContext();
		const page = await context.newPage();

		// Navigate to admin and wait for it to be ready
		await page.goto( '/wp-admin/' );
		await page.waitForLoadState( 'networkidle' );

		// Configure KaiGen settings
		await configureKaiGenProvider( page );

		await context.close();
	} );

	test.beforeEach( async ( { admin, page } ) => {
		test.setTimeout( 60000 );
		await admin.createNewPost( { showWelcomeGuide: false } );
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

		// Wait for scripts to load
		await page.waitForTimeout( 2000 );

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

		// Add debugging to check if the REST API endpoint is accessible
		const apiCheck = await page.evaluate( async () => {
			try {
				const response = await fetch(
					'/wp-json/kaigen/v1/generate-image',
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-WP-Nonce':
								( window as any ).wpApiSettings?.nonce || '',
						},
						body: JSON.stringify( {
							prompt: 'test',
							provider: 'openai',
						} ),
					}
				);
				return {
					status: response.status,
					ok: response.ok,
					statusText: response.statusText,
				};
			} catch ( error ) {
				return {
					error: error.message,
				};
			}
		} );

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
			await page.screenshot( {
				path: 'tests/test-results/full-editor-openai.png',
				fullPage: true,
			} );

			// Take a screenshot of just the image block
			await insertedImage.screenshot( {
				path: 'tests/test-results/generated-image-openai.png',
			} );
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
		await page.waitForTimeout( 500 );

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
		await page.waitForTimeout( 1000 );

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
			await page.screenshot( {
				path: 'tests/test-results/full-editor-replicate.png',
				fullPage: true,
			} );

			// Take a screenshot of just the image block
			await insertedImage.screenshot( {
				path: 'tests/test-results/generated-image-replicate.png',
			} );
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

		// Mark the image as a reference
		const kaiGenPanelToggle = page.getByRole( 'button', {
			name: 'KaiGen Settings',
		} );
		const isPanelExpanded =
			await kaiGenPanelToggle.getAttribute( 'aria-expanded' );
		if ( isPanelExpanded !== 'true' ) {
			await kaiGenPanelToggle.click();
		}

		const referenceCheckbox = page.getByRole( 'checkbox', {
			name: 'Reference image',
		} );
		await expect( referenceCheckbox ).toBeVisible( { timeout: 5000 } );
		if ( ! ( await referenceCheckbox.isChecked() ) ) {
			await referenceCheckbox.check();
			await page.waitForTimeout( 1000 );
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
			selectedCount = await page
				.locator( '.kaigen-modal-reference-image-selected' )
				.count();
			if ( selectedCount > 0 ) {
				break;
			}
			await page.waitForTimeout( 300 );
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

		// Wait a bit for error handling
		await page.waitForTimeout( 3000 );

		// Modal should still be open with error message
		await expect( modal ).toBeVisible( { timeout: 5000 } );

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
