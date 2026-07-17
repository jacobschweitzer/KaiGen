/**
 * E2E tests for the KaiGen MVP editor surface.
 */
import {
	test,
	expect,
	type FrameLocator,
	type Locator,
	type Page,
} from '@playwright/test';

type BlockRepresentation = {
	name: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: BlockRepresentation[];
};

type EditorHarness = {
	canvas: FrameLocator;
	insertBlock: ( block: BlockRepresentation ) => Promise< void >;
	selectBlocks: ( block: Locator ) => Promise< void >;
};

test.describe( 'KaiGen Image Generation', () => {
	const createEditorHarness = ( page: Page ): EditorHarness => ( {
		canvas: page.frameLocator( '[name="editor-canvas"]' ),
		insertBlock: async ( block ) => {
			await page.waitForFunction(
				() => ( window as any ).wp?.blocks && ( window as any ).wp?.data
			);

			await page.evaluate( ( blockRepresentation ) => {
				const createBlock = ( {
					name,
					attributes = {},
					innerBlocks = [],
				}: BlockRepresentation ) =>
					( window as any ).wp.blocks.createBlock(
						name,
						attributes,
						innerBlocks.map( createBlock )
					);

				( window as any ).wp.data
					.dispatch( 'core/block-editor' )
					.insertBlock( createBlock( blockRepresentation ) );
			}, block );
		},
		selectBlocks: async ( block ) => {
			const clientId = await block.getAttribute( 'data-block' );

			if ( ! clientId ) {
				throw new Error( 'Unable to select block without client ID.' );
			}

			await page.evaluate( ( selectedClientId ) => {
				( window as any ).wp.data
					.dispatch( 'core/block-editor' )
					.selectBlock( selectedClientId );
			}, clientId );
		},
	} );
	const getKaiGenModal = ( page ) => page.locator( '.kaigen-modal' ).last();
	const getKaiGenToolbarButton = ( page ) =>
		page
			.locator( 'button' )
			.filter( { has: page.locator( 'img.kaigen-toolbar-icon' ) } )
			.first();
	const getKaiGenInspectorPanelButton = ( page ) =>
		page
			.getByLabel( 'Editor settings' )
			.getByRole( 'button', { name: 'KaiGen' } );
	const ensureLoggedIn = async ( page ) => {
		const response = await page.request.post( '/wp-login.php', {
			failOnStatusCode: true,
			form: {
				log: process.env.WP_USERNAME || 'admin',
				pwd: process.env.WP_PASSWORD || 'password',
			},
			maxRedirects: 0,
		} );
		await response.dispose();
		await page.goto( '/wp-admin/', {
			waitUntil: 'domcontentloaded',
		} );
		if ( page.url().includes( 'wp-login.php' ) ) {
			throw new Error( 'WordPress login failed.' );
		}
	};
	const createNewPost = async ( page: Page ) => {
		await page.goto( '/wp-admin/post-new.php', {
			waitUntil: 'domcontentloaded',
		} );
		await page.waitForFunction( () => ( window as any ).wp?.data );
		await page.evaluate( async () => {
			const preferences = ( window as any ).wp.data.dispatch(
				'core/preferences'
			);

			await preferences.set( 'core/edit-post', 'welcomeGuide', false );
			await preferences.set( 'core/edit-post', 'fullscreenMode', false );
		} );
	};
	const waitForEditorReady = async ( page: Page ) => {
		await page.waitForURL( /post-new\.php|post\.php/ );
		await page.waitForLoadState( 'domcontentloaded' );
		await page.waitForSelector( '.edit-post-layout, .block-editor', {
			timeout: 15000,
			state: 'attached',
		} );
		await page.waitForFunction(
			() =>
				( window as any ).wp?.apiFetch &&
				( window as any ).wp?.data?.select( 'core/block-editor' )
		);
	};
	const waitForKaiGenSettings = async ( page: Page ) => {
		await page.waitForFunction( () => {
			const settings = ( window as any ).wp?.data
				?.select( 'core/editor' )
				?.getEditorSettings()?.kaigen_settings;

			return (
				settings?.is_ai_client_available === true &&
				Array.isArray( settings.providers ) &&
				settings.providers.length >= 3
			);
		} );
	};
	const dismissEditorModals = async ( page ) => {
		for ( let attempts = 0; attempts < 5; attempts++ ) {
			const overlay = page
				.locator( '.components-modal__screen-overlay' )
				.last();
			if (
				! ( await overlay
					.isVisible( { timeout: 500 } )
					.catch( () => false ) )
			) {
				continue;
			}
			const closeButton = overlay.getByRole( 'button', {
				name: /Close|Skip/i,
			} );
			if (
				await closeButton
					.isVisible( { timeout: 1000 } )
					.catch( () => false )
			) {
				await closeButton
					.click( { force: true, timeout: 1000 } )
					.catch( () => {} );
				await overlay
					.waitFor( { state: 'hidden', timeout: 3000 } )
					.catch( () => {} );
				continue;
			}
			await page.keyboard.press( 'Escape' );
		}
	};
	const dismissWelcomeGuide = async ( page: Page ) => {
		const welcomeDialog = page.getByRole( 'dialog', {
			name: 'Welcome to the editor',
		} );

		for ( let attempts = 0; attempts < 5; attempts++ ) {
			if (
				! ( await welcomeDialog
					.isVisible( { timeout: 500 } )
					.catch( () => false ) )
			) {
				continue;
			}

			await welcomeDialog
				.getByRole( 'button', { name: 'Close' } )
				.click( { force: true } );
			await welcomeDialog
				.waitFor( { state: 'hidden', timeout: 3000 } )
				.catch( () => {} );
			return;
		}
	};

	const openImageBlockSettingsTab = async ( page ) => {
		await dismissEditorModals( page );

		const settingsTab = page
			.locator( '.block-editor-block-inspector__tabs button' )
			.filter( { hasText: 'Settings' } )
			.first();
		if (
			await settingsTab
				.isVisible( { timeout: 1000 } )
				.catch( () => false )
		) {
			await settingsTab.click();
			return;
		}

		const iconSettingsTab = page
			.locator(
				'.block-editor-block-inspector__tabs button[aria-label="Settings"]'
			)
			.first();
		if (
			await iconSettingsTab
				.isVisible( { timeout: 1000 } )
				.catch( () => false )
		) {
			await iconSettingsTab.click();
		}
	};

	const openKaiGenModal = async ( page, editor, imageBlock ) => {
		const modal = getKaiGenModal( page );
		const openModal = async () => {
			await dismissWelcomeGuide( page );
			await dismissEditorModals( page );
			const placeholderButton = imageBlock.locator(
				'.kaigen-placeholder-button'
			);
			if (
				await placeholderButton
					.isVisible( { timeout: 1000 } )
					.catch( () => false )
			) {
				await placeholderButton
					.click( { timeout: 5000 } )
					.catch( async () => {
						await dismissWelcomeGuide( page );
						await dismissEditorModals( page );
						await page.keyboard.press( 'Escape' );
						await page
							.locator( '.components-modal__screen-overlay' )
							.waitFor( { state: 'hidden', timeout: 3000 } )
							.catch( () => {} );
						await placeholderButton.click();
					} );
			} else {
				await editor.selectBlocks( imageBlock );
				await getKaiGenToolbarButton( page )
					.click( { timeout: 5000 } )
					.catch( async () => {
						await dismissWelcomeGuide( page );
						await dismissEditorModals( page );
						await page.keyboard.press( 'Escape' );
						await page
							.locator( '.components-modal__screen-overlay' )
							.waitFor( { state: 'hidden', timeout: 3000 } )
							.catch( () => {} );
						await getKaiGenToolbarButton( page ).click();
					} );
			}
		};

		await openModal();
		if (
			! ( await modal
				.isVisible( { timeout: 3000 } )
				.catch( () => false ) )
		) {
			await openModal();
		}
		await expect( modal ).toBeVisible( { timeout: 10000 } );
		await dismissWelcomeGuide( page );
		return modal;
	};

	test.beforeEach( async ( { page } ) => {
		test.setTimeout( 60000 );
		await ensureLoggedIn( page );
		await createNewPost( page );
		if (
			! page.url().includes( 'post-new.php' ) &&
			! page.url().includes( 'post.php' )
		) {
			await page.goto( '/wp-admin/post-new.php', {
				waitUntil: 'domcontentloaded',
			} );
		}
		await waitForEditorReady( page );
		await waitForKaiGenSettings( page );
		await dismissWelcomeGuide( page );
		await dismissEditorModals( page );
	} );

	test( '@smoke shows KaiGen on empty image blocks and exposes MVP editor settings', async ( {
		page,
	} ) => {
		const editor = createEditorHarness( page );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );
		await expect(
			imageBlock.locator( '.components-placeholder' )
		).toBeVisible();
		await expect(
			imageBlock.locator( '.kaigen-placeholder-button' )
		).toBeVisible( { timeout: 10000 } );

		const kaiGenSettings = await page.evaluate(
			() =>
				( window as any ).wp.data
					.select( 'core/editor' )
					.getEditorSettings().kaigen_settings
		);
		const legacyKaiGenSettings = await page.evaluate(
			() =>
				( window as any ).wp.data
					.select( 'core/editor' )
					.getEditorSettings().kaigen
		);

		expect( kaiGenSettings ).toEqual(
			expect.objectContaining( {
				provider: 'auto',
				orientation: 'square',
				is_ai_client_available: true,
			} )
		);
		expect( kaiGenSettings.providers ).toEqual( [
			{ id: 'auto', name: 'Auto', referenceImageLimit: 5 },
			{ id: 'e2e-alpha', name: 'E2E Alpha', referenceImageLimit: 5 },
			{ id: 'e2e-beta', name: 'E2E Beta', referenceImageLimit: 5 },
		] );
		expect( legacyKaiGenSettings ).toBeUndefined();
	} );

	test( '@modal modal only shows MVP controls', async ( { page } ) => {
		const editor = createEditorHarness( page );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		const promptInput = modal.getByPlaceholder( 'Type to imagine' );
		await expect( promptInput ).toBeVisible();
		const referenceToggle = modal.getByRole( 'button', {
			name: 'Reference Images',
		} );
		await expect( referenceToggle ).toBeVisible();
		await referenceToggle.click();
		await expect( referenceToggle ).toHaveCSS(
			'background-color',
			'rgb(56, 88, 233)'
		);
		await expect( page.getByText( /No reference images/i ) ).toBeVisible();
		await page.keyboard.press( 'Escape' );

		const providerToggle = modal.getByRole( 'button', {
			name: /^Provider:/,
		} );
		await expect( providerToggle ).toBeVisible();
		await providerToggle.click();
		await expect( providerToggle ).toHaveCSS(
			'background-color',
			'rgb(56, 88, 233)'
		);
		await expect(
			page.getByRole( 'menuitemradio', { name: 'Auto' } )
		).toHaveAttribute( 'aria-checked', 'true' );
		await expect(
			page.getByRole( 'menuitemradio', { name: 'E2E Alpha' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitemradio', { name: 'E2E Beta' } )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );

		const aspectRatioToggle = modal.getByRole( 'button', {
			name: /^Aspect ratio:/,
		} );
		await aspectRatioToggle.click();
		await expect( aspectRatioToggle ).toHaveCSS(
			'background-color',
			'rgb(56, 88, 233)'
		);
		await expect(
			page.getByRole( 'menuitemradio', { name: /1:1.*Square/i } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitemradio', { name: /16:9.*Wide/i } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitemradio', { name: /9:16.*Vertical/i } )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );

		await expect( page.getByText( 'Quality' ) ).toHaveCount( 0 );
		await expect( page.getByText( 'Model' ) ).toHaveCount( 0 );
		await expect( page.getByText( /API key/i ) ).toHaveCount( 0 );
	} );

	test( '@generation inserts a mocked generated image into an empty image block', async ( {
		page,
	} ) => {
		test.skip(
			! ( process.env.PLAYGROUND_BLUEPRINT || '' ).endsWith(
				'e2e-generation-mocked.json'
			),
			'Requires the mocked generation blueprint.'
		);

		const editor = createEditorHarness( page );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		const promptInput = modal.getByPlaceholder( 'Type to imagine' );
		await promptInput.fill( 'subject' );
		await expect( promptInput ).toHaveValue( 'subject' );
		const generateButton = modal.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeEnabled();

		const generationResponsePromise = page.waitForResponse(
			( response ) =>
				response.url().includes( '/kaigen/v1/generate-image' ) &&
				response.request().method() === 'POST',
			{ timeout: 30000 }
		);
		await generateButton.click( { force: true } );
		const generationResponse = await generationResponsePromise;
		expect( generationResponse.ok() ).toBe( true );
		const generationResult = await generationResponse.json();
		expect( generationResult.status ).toBe( 'completed' );
		expect( generationResult.metadata ).toEqual(
			expect.objectContaining( {
				provider_metadata: expect.objectContaining( {
					provider: 'e2e-alpha',
				} ),
				model_metadata: expect.objectContaining( {
					model: 'e2e-image-model',
				} ),
			} )
		);

		const imageAttributes = await page.evaluate( () => {
			const imageBlockInEditor = ( window as any ).wp.data
				.select( 'core/block-editor' )
				.getBlocks()
				.find( ( block ) => block.name === 'core/image' );

			return imageBlockInEditor?.attributes;
		} );

		expect( imageAttributes.id ).toBeGreaterThan( 0 );
		expect( imageAttributes.url ).toMatch( /ai-subject(?:-\d+)?\.png/ );
		await expect( imageBlock.locator( 'img' ).first() ).toHaveAttribute(
			'src',
			/ai-subject(?:-\d+)?\.png/
		);
	} );

	test( '@reference persists reference image marking in the image block sidebar', async ( {
		page,
	} ) => {
		const editor = createEditorHarness( page );

		await waitForEditorReady( page );
		const fixtureMedia = await page.evaluate( async () =>
			( window as any ).wp.apiFetch( {
				path: '/kaigen-e2e/v1/reference-media',
				method: 'POST',
			} )
		);
		expect( fixtureMedia ).toEqual(
			expect.arrayContaining( [
				expect.objectContaining( { marked: true } ),
				expect.objectContaining( { marked: false } ),
			] )
		);

		const markedFixture = fixtureMedia.find( ( item ) => item.marked );
		expect( markedFixture.id ).toBeGreaterThan( 0 );
		expect( markedFixture.url ).toContain( 'kaigen-reference-marked' );
		const unmarkedFixture = fixtureMedia.find( ( item ) => ! item.marked );
		expect( unmarkedFixture.id ).toBeGreaterThan( 0 );
		expect( unmarkedFixture.url ).toContain( 'kaigen-reference-unmarked' );

		await page.evaluate( async ( item ) => {
			( window as any ).wp.data
				.dispatch( 'core/block-editor' )
				.insertBlock(
					( window as any ).wp.blocks.createBlock( 'core/image', {
						id: item.id,
						url: item.url,
					} )
				);
		}, unmarkedFixture );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );
		await editor.selectBlocks( imageBlock );
		await openImageBlockSettingsTab( page );

		const kaiGenPanelButton = getKaiGenInspectorPanelButton( page );
		await expect( kaiGenPanelButton ).toBeVisible( { timeout: 10000 } );
		if (
			( await kaiGenPanelButton.getAttribute( 'aria-expanded' ) ) !==
			'true'
		) {
			await kaiGenPanelButton.click();
		}

		const referenceImageCheckbox = page.getByRole( 'checkbox', {
			name: 'Reference image',
		} );
		await expect( referenceImageCheckbox ).toBeVisible( {
			timeout: 10000,
		} );
		await expect( referenceImageCheckbox ).not.toBeChecked();

		const attachmentId = await page.evaluate( () => {
			const selectedBlock = ( window as any ).wp.data
				.select( 'core/block-editor' )
				.getSelectedBlock();
			return Number( selectedBlock?.attributes?.id );
		} );

		const markResponsePromise = page.waitForResponse(
			( response ) =>
				response
					.url()
					.includes( `/wp-json/wp/v2/media/${ attachmentId }` ) &&
				response.request().method() === 'POST'
		);
		await referenceImageCheckbox.check();
		expect( ( await markResponsePromise ).ok() ).toBe( true );

		await expect
			.poll(
				async () =>
					page.evaluate( async ( id ) => {
						const response = await ( window as any ).wp.apiFetch( {
							path: `/wp/v2/media/${ id }`,
						} );
						return response?.meta?.kaigen_reference_image;
					}, attachmentId ),
				{ timeout: 10000 }
			)
			.toBe( true );

		const referenceImages = await page.evaluate( async () =>
			( window as any ).wp.apiFetch( {
				path: '/kaigen/v1/reference-images',
			} )
		);

		expect(
			referenceImages.some( ( image ) => image.id === attachmentId )
		).toBe( true );
		await expect( referenceImageCheckbox ).toBeChecked();

		const unmarkResponsePromise = page.waitForResponse(
			( response ) =>
				response
					.url()
					.includes( `/wp-json/wp/v2/media/${ attachmentId }` ) &&
				response.request().method() === 'POST'
		);
		await referenceImageCheckbox.uncheck();
		expect( ( await unmarkResponsePromise ).ok() ).toBe( true );
		await expect( referenceImageCheckbox ).not.toBeChecked();

		await expect
			.poll(
				async () =>
					page.evaluate( async ( id ) => {
						const response = await ( window as any ).wp.apiFetch( {
							path: `/wp/v2/media/${ id }`,
						} );
						return response?.meta?.kaigen_reference_image;
					}, attachmentId ),
				{ timeout: 10000 }
			)
			.toBe( false );

		const updatedReferenceImages = await page.evaluate( async () =>
			( window as any ).wp.apiFetch( {
				path: '/kaigen/v1/reference-images',
			} )
		);

		expect(
			updatedReferenceImages.some(
				( image ) => image.id === attachmentId
			)
		).toBe( false );
	} );
} );
