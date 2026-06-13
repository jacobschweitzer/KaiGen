import fs from 'fs';
import path from 'path';

describe( 'GenerateImageModal', () => {
	it( 'sizes the modal frame toward a square layout', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal\.components-modal__frame\s*\{[^}]*width:\s*min\(96vw,\s*980px\);[^}]*height:\s*min\(96vw,\s*980px,\s*calc\(100vh - 48px\)\);[^}]*max-height:\s*calc\(100vh - 48px\);/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal\s+\.components-modal__content\s*\{[^}]*box-sizing:\s*border-box;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__stage\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*clamp\(280px,\s*calc\(min\(96vw,\s*980px,\s*calc\(100vh - 48px\)\) - 168px\),\s*720px\);/s
		);
	} );

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
			/hasProviderChoices\s+&&\s+\(\s*<Dropdown[\s\S]*className=\{\s*`kaigen-modal__provider-toggle/
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
			/isDropdownOpen\s*\?\s*'is-primary'\s*:\s*''/
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

	it( 'renders reference images in a dropdown menu instead of an expanding panel', () => {
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
			/referenceImagesDropdown\s*=\s*\(\s*<Dropdown[\s\S]*className=\{\s*`kaigen-modal__ref-button/
		);
		expect( source ).toMatch(
			/renderContent=\{\s*\(\s*\)\s*=>\s*\([\s\S]*className="kaigen-modal__reference-menu"/
		);
		expect( source ).toMatch(
			/<div className="kaigen-modal__prompt-action">[\s\S]*\{ referenceImagesDropdown \}[\s\S]*\{ aspectRatioDropdown \}/
		);
		expect( source ).not.toContain( 'kaigen-modal__reference-panel' );
		expect( styles ).toMatch(
			/\.kaigen-modal__reference-menu\s*\{[^}]*background:\s*#fff;[^}]*border:\s*1px solid #ddd;[^}]*border-radius:\s*18px;[^}]*box-shadow:\s*0 8px 22px rgba\(0, 0, 0, 0\.14\);/s
		);
	} );

	it( 'shows reference image thumbnails at their full 150px size', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal-reference-images-container\s*\{[^}]*max-width:\s*720px;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal-reference-image\s*\{[^}]*width:\s*150px;[^}]*height:\s*150px;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal-reference-image img\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover;/s
		);
	} );

	it( 'shows selected reference image thumbnails with a thicker border', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal-reference-image-selected\s*\{[^}]*border:\s*4px solid #3858e9;/s
		);
	} );

	it( 'renders the provider selector as a circular dropdown', () => {
		const styles = fs.readFileSync(
			path.join( __dirname, '../../assets/kaigen-admin.css' ),
			'utf8'
		);

		expect( styles ).toMatch(
			/\.kaigen-modal__ref-button,\s*\.kaigen-modal__aspect-ratio-toggle,\s*\.kaigen-modal__provider-toggle,\s*\.kaigen-modal__submit-button\s*\{[^}]*border-radius:\s*999px;[^}]*height:\s*48px;[^}]*min-width:\s*48px;[^}]*padding:\s*0;[^}]*width:\s*48px;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__ref-button,\s*\.kaigen-modal__aspect-ratio-toggle,\s*\.kaigen-modal__provider-toggle\s*\{[^}]*background:\s*#fff;[^}]*border:\s*1px solid #d6d9dd;[^}]*color:\s*#1f2328;/s
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
			/\.kaigen-modal__ref-button,\s*\.kaigen-modal__aspect-ratio-toggle,\s*\.kaigen-modal__provider-toggle,\s*\.kaigen-modal__submit-button\s*\{[^}]*border-radius:\s*999px;[^}]*height:\s*48px;[^}]*min-width:\s*48px;[^}]*padding:\s*0;[^}]*width:\s*48px;/s
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
			/\.kaigen-modal__ref-button,\s*\.kaigen-modal__aspect-ratio-toggle,\s*\.kaigen-modal__provider-toggle,\s*\.kaigen-modal__submit-button\s*\{[^}]*height:\s*48px;[^}]*min-width:\s*48px;[^}]*width:\s*48px;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__output-action\s*\{[^}]*display:\s*flex;[^}]*gap:\s*10px;/s
		);
	} );

	it( 'uses white closed and blue open styles for menu toggle buttons', () => {
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
			/className=\{\s*`kaigen-modal__aspect-ratio-toggle\s+\$\{\s*isDropdownOpen\s*\?\s*'is-primary'\s*:\s*''\s*\}/
		);
		expect( source ).toMatch(
			/className=\{\s*`kaigen-modal__provider-toggle\s+\$\{\s*isDropdownOpen\s*\?\s*'is-primary'\s*:\s*''\s*\}/
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__ref-button,\s*\.kaigen-modal__aspect-ratio-toggle,\s*\.kaigen-modal__provider-toggle\s*\{[^}]*background:\s*#fff;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__ref-button\.components-button\.is-primary,\s*\.kaigen-modal__aspect-ratio-toggle\.components-button\.is-primary,\s*\.kaigen-modal__provider-toggle\.components-button\.is-primary,[\s\S]*background:\s*#3858e9;[\s\S]*border-color:\s*#3858e9;[\s\S]*color:\s*#fff;/s
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

	it( 'previews the current image when regenerating an existing image block', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).toMatch(
			/setGeneratedImage\(\s*initialReferenceImage\?\.url\s*\?\s*initialReferenceImage\s*:\s*null\s*\);/
		);
		expect( source ).toMatch(
			/if\s*\(\s*initialReferenceImageId\s*\)\s*\{\s*setSelectedRefs\(\s*\[\s*initialReferenceImage\s*\]\s*\);/s
		);
	} );

	it( 'keeps the modal open and selects the generated image as the next reference', () => {
		const source = fs.readFileSync(
			path.join(
				__dirname,
				'../../src/components/GenerateImageModal.js'
			),
			'utf8'
		);

		expect( source ).toContain(
			'const [ generatedImage, setGeneratedImage ]'
		);
		expect( source ).toMatch(
			/const media = await generateImage\(\s*prompt\.trim\(\),\s*options\s*\);[\s\S]*setGeneratedImage\(\s*media\s*\);[\s\S]*setSelectedRefs\(\s*getReferenceImageId\(\s*media\s*\)\s*\?\s*\[\s*media\s*\]\s*:\s*\[\s*\]\s*\);[\s\S]*onSelect\(\s*media\s*\);[\s\S]*setIsLoading\(\s*false\s*\);/s
		);

		const successBlock = source.match(
			/try\s*\{[\s\S]*?const media = await generateImage[\s\S]*?\}\s*catch/
		)?.[ 0 ];

		expect( successBlock ).toBeTruthy();
		expect( successBlock ).not.toContain( 'handleClose()' );
	} );

	it( 'renders a generated image preview inside the modal stage', () => {
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

		expect( source ).toContain(
			'className="kaigen-modal__generated-preview"'
		);
		expect( source ).toMatch(
			/className=\{\s*`kaigen-modal__stage\s+\$\{\s*generatedImage\?\.url\s*\?\s*'has-generated-image'\s*:\s*''\s*\}`\s*\}/
		);
		expect( source ).toMatch(
			/<img[\s\S]*src=\{\s*generatedImage\.url\s*\}[\s\S]*alt=\{\s*generatedImage\.alt\s*\|\|\s*''\s*\}/
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__stage\.has-generated-image\s*\{[^}]*align-content:\s*stretch;[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto;[^}]*justify-content:\s*stretch;[^}]*min-height:\s*clamp\(280px,\s*calc\(min\(96vw,\s*980px,\s*calc\(100vh - 48px\)\) - 168px\),\s*720px\);[^}]*overflow:\s*hidden;[^}]*width:\s*100%;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__generated-preview\s*\{[^}]*align-items:\s*center;[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s
		);
		expect( styles ).toMatch(
			/\.kaigen-modal__generated-preview img\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*min\(56vh,\s*540px\);[^}]*max-width:\s*min\(72vw,\s*760px\);[^}]*object-fit:\s*contain;[^}]*width:\s*auto;/s
		);
	} );
} );
