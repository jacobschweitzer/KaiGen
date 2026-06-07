import fs from 'fs';
import path from 'path';

describe( 'GenerateImageModal', () => {
	it( 'only renders the provider selector when multiple real providers are available', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).toMatch(
			/selectableProviders\s*=\s*availableProviders\.filter\(\s*\(\s*opt\s*\)\s*=>\s*opt\.id\s*!==\s*'auto'\s*\)/
		);
		expect( source ).toContain(
			'const hasProviderChoices = selectableProviders.length > 1;'
		);
		expect( source ).toMatch(
			/hasProviderChoices\s+&&\s+\(\s*<ButtonGroup\s+className="kaigen-modal__provider-options"/
		);
	} );

	it( 'only applies the primary variant to the submit button when a prompt is entered', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).toMatch(
			/variant=\{\s*prompt\.trim\(\)\s*\?\s*'primary'\s*:\s*undefined\s*\}/
		);
	} );

	it( 'keeps the reference image button icon stable while applying primary styling when open', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).toMatch(
			/showReferenceImages\s*\?\s*'is-primary'\s*:\s*''/
		);
		expect( source ).toMatch(
			/<Dashicon\s+icon="format-image"\s+className=/
		);
		expect( source ).not.toMatch( /icon=\{\s*showReferenceImages/ );
	} );

	it( 'turns the reference image icon white while the button is primary', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal__ref-button\.is-primary\s+\.dashicon\s*\{[^}]*color:\s*#fff;/s
		);
	} );

	it( 'keeps selected provider button text white when idle, focused, or hovered', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal__provider-button\.components-button\.kaigen-modal__provider-button-selected\s*\{[^}]*border-radius:\s*999px;[^}]*color:\s*#fff;[^}]*height:\s*48px;[^}]*width:\s*48px;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__provider-button\.components-button\.kaigen-modal__provider-button-selected:focus[^{]*\{[^}]*color:\s*#fff;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__provider-button\.components-button\.kaigen-modal__provider-button-selected:hover[^{]*\{[^}]*color:\s*#fff;/s
		);
	} );

	it( 'renders icon-only provider buttons as circles', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal__provider-button\.components-button\.kaigen-modal__provider-button-icon-only\s*\{[^}]*border-radius:\s*999px;[^}]*height:\s*48px;[^}]*min-width:\s*48px;[^}]*padding:\s*0;[^}]*width:\s*48px;/s
		);
	} );

	it( 'keeps the Auto provider button circular when unselected', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).toMatch(
			/providerLogo\s*\|\|\s*opt\.id\s*===\s*'auto'/
		);
	} );

	it( 'does not pass URL-only references to image generation', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).not.toContain( 'sourceImageUrls' );
	} );

	it( 'uses reference image IDs for selection state', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).toContain( 'getReferenceImageId' );
		expect( source ).not.toContain( 'selected.url === img.url' );
		expect( source ).not.toContain( 'selected.url !== img.url' );
		expect( source ).toMatch(
			/if\s*\(\s*initialReferenceImageId\s*\)\s*\{\s*setSelectedRefs\(\s*\[\s*initialReferenceImage\s*\]\s*\);/s
		);
	} );
} );
