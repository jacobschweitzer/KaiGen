import apiFetch from '@wordpress/api-fetch';

import { generateImage } from '../../src/api';

jest.mock( '@wordpress/api-fetch' );

describe( 'generateImage', () => {
	beforeEach( () => {
		apiFetch.mockReset();
	} );

	it( 'posts the generation payload and returns normalized media', async () => {
		apiFetch.mockResolvedValue( {
			id: 123,
			url: 'https://example.com/generated-image.jpg',
			metadata: {
				provider: 'openai',
			},
		} );

		const media = await generateImage( 'A robot painting a mural', {
			provider: 'openai',
			orientation: 'landscape',
			sourceImageIds: [ 10, 11 ],
		} );

		expect( apiFetch ).toHaveBeenCalledWith( {
			path: '/kaigen/v1/generate-image',
			method: 'POST',
			data: {
				prompt: 'A robot painting a mural',
				provider: 'openai',
				orientation: 'landscape',
				source_image_ids: [ 10, 11 ],
			},
		} );
		expect( media ).toEqual( {
			id: 123,
			url: 'https://example.com/generated-image.jpg',
			alt: 'A robot painting a mural',
			caption: '',
			metadata: {
				provider: 'openai',
			},
		} );
	} );

	it( 'does not post URL-only reference images', async () => {
		apiFetch.mockResolvedValue( {
			id: 124,
			url: 'https://example.com/generated-image.jpg',
		} );

		await generateImage( 'A robot painting a mural', {
			sourceImageIds: [ 10 ],
			sourceImageUrls: [ 'https://example.com/reference.jpg' ],
		} );

		expect( apiFetch ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.not.objectContaining( {
					source_image_urls: expect.any( Array ),
				} ),
			} )
		);
		expect( apiFetch ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( {
					source_image_ids: [ 10 ],
				} ),
			} )
		);
	} );

	it( 'throws when the server response does not include an image URL', async () => {
		apiFetch.mockResolvedValue( {
			id: 123,
		} );

		await expect( generateImage( 'A missing image URL' ) ).rejects.toThrow(
			'Invalid response from server: {"id":123}'
		);
	} );
} );
