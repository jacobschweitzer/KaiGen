import fs from 'fs';
import path from 'path';

import {
	normalizePromptRefinements,
	replacePromptTerm,
} from '../../src/utils/promptRefinement';

describe( 'promptRefinement', () => {
	it( 'normalizes model-returned terms without filtering stop words', () => {
		const refinements = normalizePromptRefinements( 'a duck in a pond', {
			terms: [
				{
					text: 'a',
					choices: [ 'storybook singular focus' ],
				},
				{
					text: 'duck',
					choices: [
						'mallard with emerald head',
						'mallard with emerald head',
						'duck',
					],
				},
				{
					text: 'missing hillside',
					choices: [ 'should not render' ],
				},
			],
		} );

		expect( refinements ).toEqual( [
			{
				id: 'a-0',
				text: 'a',
				start: 0,
				end: 1,
				choices: [ 'storybook singular focus' ],
			},
			{
				id: 'duck-2',
				text: 'duck',
				start: 2,
				end: 6,
				choices: [ 'mallard with emerald head' ],
			},
		] );
	} );

	it( 'does not invent local fallback suggestions when the model returns none', () => {
		expect(
			normalizePromptRefinements( 'world cup game', { terms: [] } )
		).toEqual( [] );
		expect( normalizePromptRefinements( 'world cup game', null ) ).toEqual(
			[]
		);
	} );

	it( 'does not keep hardcoded term or stop-word expansion sources', () => {
		const source = fs.readFileSync(
			path.join( __dirname, '../../src/utils/promptRefinement.js' ),
			'utf8'
		);

		expect( source ).not.toMatch(
			/STOP_WORDS|TERM_EXPANSIONS|CONTEXTUAL_TERM_EXPANSIONS|KNOWN_PROMPT_PHRASES|getTermExpansionChoices|getDefaultChoices/
		);
		expect( source ).not.toMatch(
			/yellow duck|specific visual twist|dusty sunlight|vivid/
		);
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
} );
