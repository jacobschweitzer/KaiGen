import fs from 'fs';
import path from 'path';

describe( 'addBlockEditFilter', () => {
	it( 'passes the current image URL to the modal even without a valid attachment ID', () => {
		const source = fs.readFileSync(
			path.join( __dirname, '../../src/filters/addBlockEditFilter.js' ),
			'utf8'
		);

		expect( source ).toMatch(
			/const currentImage\s*=\s*props\.attributes\.url\s*\?/
		);
		expect( source ).toMatch(
			/id:\s*hasValidId\s*\?\s*normalizedBlockId\s*:\s*undefined/
		);
		expect( source ).not.toMatch(
			/const currentImage\s*=\s*hasValidId && props\.attributes\.url\s*\?/
		);
	} );

	it( 'updates alt text when replacing an existing image', () => {
		const source = fs.readFileSync(
			path.join( __dirname, '../../src/filters/addBlockEditFilter.js' ),
			'utf8'
		);

		expect( source ).toMatch(
			/props\.setAttributes\(\s*{\s*url: result\.url,\s*id: result\.id,\s*alt: result\.alt \|\| '',\s*}\s*\)/
		);
	} );
} );
