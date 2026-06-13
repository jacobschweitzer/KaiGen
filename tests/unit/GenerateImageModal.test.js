import fs from 'fs';
import path from 'path';

describe( 'GenerateImageModal', () => {
	it( 'only renders the provider dropdown when multiple real providers are available', () => {
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
			/hasProviderChoices\s+&&\s+\(\s*<Dropdown[\s\S]*className="kaigen-modal__provider-toggle"/
		);
		expect( source ).not.toContain( '<ButtonGroup' );
	} );

	it( 'places the provider dropdown on the output side before the submit button', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).toMatch(
			/<div className="kaigen-modal__output-action">[\s\S]*\{ providerDropdown \}[\s\S]*className="kaigen-modal__submit-button"/
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

	it( 'renders the provider selector as a circular dropdown', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal__provider-toggle\s*\{[^}]*background:\s*#fff;[^}]*border:\s*1px solid #d6d9dd;[^}]*border-radius:\s*999px;[^}]*height:\s*48px;[^}]*min-width:\s*48px;[^}]*padding:\s*0;[^}]*width:\s*48px;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__provider-toggle-icon\s*\{[^}]*display:\s*none;/s
		);
	} );

	it( 'renders provider choices in an expanding menu', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( source ).toContain( 'className="kaigen-modal__provider-menu"' );
		expect( styles ).toMatch(
			/\.kaigen-modal__provider-menu\s*\{[^}]*background:\s*#fff;[^}]*border:\s*1px solid #ddd;[^}]*min-width:\s*180px;/s
		);
	} );

	it( 'shows the selected provider name in the dropdown toggle', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).toContain(
			'kaigen-modal__provider-toggle-label-hidden'
		);
		expect( source ).toMatch(
			/selectedProviderLogo[\s\S]*\? 'kaigen-modal__provider-toggle-label-hidden'/
		);
		expect( source ).toMatch(
			/selectedProviderLogo\s+&&\s+\([\s\S]*className="kaigen-modal__provider-logo"/
		);
		expect( source ).toMatch(
			/providerLogo\s+&&\s+\([\s\S]*className="kaigen-modal__provider-logo"/
		);
	} );

	it( 'renders the aspect ratio toggle as an icon-only circle', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);
		const toggleMarkup = source.match(
			/renderToggle=\{[\s\S]*?renderContent=/
		)[ 0 ];

		expect( toggleMarkup ).not.toContain(
			'kaigen-modal__aspect-ratio-ratio'
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__aspect-ratio-toggle\s*\{[^}]*border-radius:\s*999px;[^}]*height:\s*48px;[^}]*min-width:\s*48px;[^}]*padding:\s*0;[^}]*width:\s*48px;/s
		);
	} );

	it( 'groups the aspect ratio toggle with the reference image button', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( source ).toMatch(
			/<div className="kaigen-modal__prompt-action">[\s\S]*\{ aspectRatioDropdown \}[\s\S]*<div\s+className="kaigen-modal__textarea-container"/
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__prompt-action\s*\{[^}]*display:\s*flex;[^}]*gap:\s*10px;/s
		);
	} );

	it( 'aligns provider options with the prompt text', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal__ref-button\s*\{[^}]*height:\s*48px;[^}]*min-width:\s*48px;[^}]*width:\s*48px;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__output-action\s*\{[^}]*display:\s*flex;[^}]*gap:\s*10px;/s
		);
	} );

	it( 'keeps the aspect ratio toggle background white', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal__aspect-ratio-toggle\s*\{[^}]*background:\s*#fff;/s
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
