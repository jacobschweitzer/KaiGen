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

	const openImageBlockSettingsTab = async ( page ) => {
		await page.keyboard.press( 'Escape' );

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

		const modal = getKaiGenModal( page );
		await expect( modal ).toBeVisible( { timeout: 10000 } );
		return modal;
	};

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
			} )
		);
		expect( kaiGenSettings.providers ).toEqual( [
			{ id: 'auto', name: 'Auto', referenceImageLimit: 5 },
		] );
		expect( legacyKaiGenSettings ).toBeUndefined();
	} );

	test( 'modal only shows MVP controls', async ( { editor, page } ) => {
		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		await expect(
			modal.getByPlaceholder( 'Image prompt...' )
		).toBeVisible();
		await expect(
			modal.getByRole( 'button', { name: 'Reference Images' } )
		).toBeVisible();
		await modal.getByRole( 'button', { name: 'Reference Images' } ).click();
		await expect(
			page.getByRole( 'heading', { name: 'Reference Images' } )
		).toBeVisible();
		await expect( page.getByText( 'Limit 5' ) ).toBeVisible();

		await modal.getByRole( 'button', { name: 'Settings' } ).click();
		await expect(
			page.getByRole( 'heading', { name: 'Provider' } )
		).toBeVisible();
		await expect( page.getByLabel( 'Provider' ) ).toHaveValue( 'auto' );
		await expect(
			page.getByRole( 'button', { name: 'Square' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'button', { name: 'Landscape' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'button', { name: 'Portrait' } )
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
		await referenceImageCheckbox.check();

		const attachmentId = await page.evaluate( () => {
			const selectedBlock = ( window as any ).wp.data
				.select( 'core/block-editor' )
				.getSelectedBlock();
			return Number( selectedBlock?.attributes?.id );
		} );

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
	} );
} );
