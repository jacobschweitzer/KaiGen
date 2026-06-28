import {
	appendPromptDetail,
	extractPromptTerms,
	getRefinementStage,
	getTermExpansionChoices,
	replacePromptTerm,
} from '../../src/utils/promptRefinement';

describe( 'promptRefinement', () => {
	it( 'extracts meaningful prompt terms and skips filler words', () => {
		const terms = extractPromptTerms( 'a duck in a pond with the sun' );

		expect( terms.map( ( term ) => term.text ) ).toEqual( [
			'duck',
			'pond',
			'sun',
		] );
		expect( terms[ 0 ] ).toEqual(
			expect.objectContaining( {
				id: 'duck-2',
				normalized: 'duck',
				start: 2,
				end: 6,
			} )
		);
	} );

	it( 'returns deterministic term expansion choices', () => {
		expect( getTermExpansionChoices( 'duck' ) ).toEqual( [
			'yellow duck',
			'angry duck',
			'tall duck',
		] );
		expect( getTermExpansionChoices( 'castle' ) ).toEqual( [
			'vivid castle',
			'weathered castle',
			'miniature castle',
		] );
		expect( getTermExpansionChoices( '' ) ).toEqual( [] );
	} );

	it( 'replaces only the selected prompt term occurrence', () => {
		const prompt = 'duck beside another duck';
		const secondDuck = {
			text: 'duck',
			start: 20,
			end: 24,
		};

		expect( replacePromptTerm( prompt, secondDuck, 'yellow duck' ) ).toBe(
			'duck beside another yellow duck'
		);
	} );

	it( 'appends details with readable punctuation', () => {
		expect( appendPromptDetail( 'a duck.', 'soft light' ) ).toBe(
			'a duck, soft light'
		);
		expect( appendPromptDetail( 'a soft lighthouse', 'soft light' ) ).toBe(
			'a soft lighthouse, soft light'
		);
		expect( appendPromptDetail( '', 'soft light' ) ).toBe( 'soft light' );
		expect( appendPromptDetail( 'a duck, soft light', 'soft light' ) ).toBe(
			'a duck, soft light'
		);
	} );

	it( 'falls back to the first refinement stage for unknown stages', () => {
		expect( getRefinementStage( 'missing' ) ).toEqual(
			expect.objectContaining( {
				id: 'idea',
				question: 'What is the main thing you want to see?',
			} )
		);
	} );
} );
