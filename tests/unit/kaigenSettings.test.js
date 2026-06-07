import { select } from '@wordpress/data';

import { isKaiGenAvailable } from '../../src/utils/kaigenSettings';

jest.mock( '@wordpress/data', () => ( {
	select: jest.fn(),
} ) );

describe( 'isKaiGenAvailable', () => {
	const setKaiGenSettings = ( kaigenSettings ) => {
		select.mockReturnValue( {
			getEditorSettings: () => ( {
				kaigen_settings: kaigenSettings,
			} ),
		} );
	};

	beforeEach( () => {
		select.mockReset();
	} );

	it( 'returns false when the AI client exists but no image providers are available', () => {
		setKaiGenSettings( {
			is_ai_client_available: true,
			providers: [],
		} );

		expect( isKaiGenAvailable() ).toBe( false );
	} );

	it( 'returns true when a configured provider is available', () => {
		setKaiGenSettings( {
			is_ai_client_available: true,
			providers: [
				{ id: 'auto', name: 'Auto' },
				{ id: 'google', name: 'Google' },
			],
		} );

		expect( isKaiGenAvailable() ).toBe( true );
	} );
} );
