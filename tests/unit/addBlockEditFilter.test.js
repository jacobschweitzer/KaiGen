import fs from 'fs';
import path from 'path';

describe( 'addBlockEditFilter', () => {
	it( 'only passes the current image as a reference when it has a valid attachment ID', () => {
		const source = fs.readFileSync(
			path.join( __dirname, '../../src/filters/addBlockEditFilter.js' ),
			'utf8'
		);

		expect( source ).toMatch(
			/const currentImage\s*=\s*hasValidId && props\.attributes\.url\s*\?/
		);
		expect( source ).toMatch( /id: normalizedBlockId/ );
		expect( source ).not.toMatch(
			/const currentImage = props\.attributes\.url/
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
