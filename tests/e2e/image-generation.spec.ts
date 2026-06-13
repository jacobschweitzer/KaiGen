/**
 * E2E tests for the KaiGen MVP editor surface.
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

test.describe( 'KaiGen Image Generation', () => {
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

	test.beforeEach( async ( { admin, page } ) => {
		test.setTimeout( 60000 );
		await ensureLoggedIn( page );
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
		await dismissEditorModals( page );
	} );

	test( 'shows KaiGen on empty image blocks and exposes MVP editor settings', async ( {
		editor,
		page,
	} ) => {
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

	test( 'modal only shows MVP controls', async ( { editor, page } ) => {
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		await expect(
			modal.getByPlaceholder( 'Type to imagine' )
		).toBeVisible();
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

		await expect( page.getByText( 'Quality' ) ).toHaveCount( 0 );
		await expect( page.getByText( 'Model' ) ).toHaveCount( 0 );
		await expect( page.getByText( /API key/i ) ).toHaveCount( 0 );
	} );

	test( 'persists reference image marking in the image block sidebar', async ( {
		editor,
		page,
	} ) => {
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
