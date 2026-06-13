import fs from 'fs';
import path from 'path';

describe( 'editor entrypoint', () => {
	it( 'loads image placeholder and toolbar integrations without the replace menu integration', () => {
		const entrypoint = fs.readFileSync(
			path.join( __dirname, '../../src/index.js' ),
			'utf8'
		);

		expect( entrypoint ).toContain( './filters/addMediaPlaceholderFilter' );
		expect( entrypoint ).toContain( './filters/addBlockEditFilter' );
		expect( entrypoint ).not.toContain(
			'./filters/addMediaReplaceFlowFilter'
		);
	} );
} );
