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
	const getKaiGenModal = ( page ) => page.locator( '.kaigen-modal' ).first();
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
		} );
		await response.dispose();
		await page.goto( '/wp-admin/' );
		if ( page.url().includes( 'wp-login.php' ) ) {
			throw new Error( 'WordPress login failed.' );
		}
	};
	const createNewPost = async ( page: Page ) => {
		await page.goto( '/wp-admin/post-new.php' );
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
	const dismissEditorModals = async ( page ) => {
		for ( let attempts = 0; attempts < 3; attempts++ ) {
			const overlay = page
				.locator( '.components-modal__screen-overlay' )
				.first();
			if (
				! ( await overlay
					.isVisible( { timeout: 1000 } )
					.catch( () => false ) )
			) {
				return;
			}
			const closeButton = overlay.getByRole( 'button', {
				name: 'Close',
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
			await dismissEditorModals( page );
			const placeholderButton = imageBlock.locator(
				'.kaigen-placeholder-button'
			);
			if (
				await placeholderButton
					.isVisible( { timeout: 1000 } )
					.catch( () => false )
			) {
				await placeholderButton.click();
			} else {
				await editor.selectBlocks( imageBlock );
				await getKaiGenToolbarButton( page ).click();
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
			await page.goto( '/wp-admin/post-new.php' );
		}
		await waitForEditorReady( page );
		await dismissEditorModals( page );
	} );

	test( 'shows KaiGen on empty image blocks and exposes MVP editor settings', async ( {
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

	test( 'modal only shows MVP controls', async ( { page } ) => {
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

		const interactiveToggle = modal.getByRole( 'button', {
			name: 'Interactive mode',
		} );
		await expect( interactiveToggle ).toBeVisible();
		await expect( interactiveToggle ).toHaveAttribute(
			'aria-pressed',
			'false'
		);
		await promptInput.fill( 'a duck' );
		await interactiveToggle.click();
		await expect( interactiveToggle ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(
			modal.getByText( 'What is the main thing you want to see?' )
		).toBeVisible();
		await expect(
			modal.getByRole( 'tab', { name: 'Idea' } )
		).toHaveAttribute( 'aria-selected', 'true' );
		await modal.getByRole( 'button', { name: 'duck' } ).click();
		await page.getByRole( 'menuitem', { name: 'yellow duck' } ).click();
		await expect( promptInput ).toHaveValue( 'a yellow duck' );

		await expect( page.getByText( 'Quality' ) ).toHaveCount( 0 );
		await expect( page.getByText( 'Model' ) ).toHaveCount( 0 );
		await expect( page.getByText( /API key/i ) ).toHaveCount( 0 );
	} );

	test( 'persists reference image marking in the image block sidebar', async ( {
		page,
	} ) => {
		const editor = createEditorHarness( page );

		await waitForEditorReady( page );
		await page.evaluate( async () => {
			const pngBase64 =
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
			const response = await fetch(
				'data:image/png;base64,' + pngBase64
			);
			const blob = await response.blob();
			const file = new File( [ blob ], 'kaigen-reference.png', {
				type: 'image/png',
			} );
			const upload = await fetch(
				( window as any ).wpApiSettings.root + 'wp/v2/media',
				{
					method: 'POST',
					headers: {
						'Content-Disposition':
							'attachment; filename="kaigen-reference.png"',
						'Content-Type': file.type,
						'X-WP-Nonce': ( window as any ).wpApiSettings.nonce,
					},
					credentials: 'same-origin',
					body: file,
				}
			);
			if ( ! upload.ok ) {
				throw new Error( 'Failed to upload reference image fixture.' );
			}
			const item = await upload.json();
			( window as any ).wp.data
				.dispatch( 'core/block-editor' )
				.insertBlock(
					( window as any ).wp.blocks.createBlock( 'core/image', {
						id: item.id,
						url: item.source_url,
					} )
				);
		} );

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
