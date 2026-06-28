const STOP_WORDS = new Set( [
	'a',
	'an',
	'and',
	'are',
	'as',
	'at',
	'be',
	'by',
	'for',
	'from',
	'in',
	'into',
	'is',
	'it',
	'of',
	'on',
	'or',
	'the',
	'to',
	'with',
] );

const TERM_EXPANSIONS = {
	duck: [ 'yellow duck', 'angry duck', 'tall duck' ],
	person: [
		'weathered portrait subject',
		'confident person',
		'silhouetted person',
	],
	city: [ 'rainy neon city', 'ancient city', 'sunlit coastal city' ],
	forest: [ 'misty old-growth forest', 'emerald forest', 'moonlit forest' ],
	room: [ 'warm candlelit room', 'minimal white room', 'dusty attic room' ],
	logo: [
		'bold geometric logo',
		'hand-drawn logo',
		'minimal monochrome logo',
	],
	comic: [
		'four-panel comic scene',
		'inked comic frame',
		'dynamic comic splash',
	],
	poster: [
		'screen-printed poster',
		'bold editorial poster',
		'retro travel poster',
	],
};

export const REFINEMENT_STAGES = [
	{
		id: 'idea',
		label: 'Idea',
		question: 'What is the main thing you want to see?',
		chips: [
			{ label: 'Make it specific', text: 'with one clear subject' },
			{ label: 'Add a setting', text: 'in a memorable setting' },
			{ label: 'Add action', text: 'caught in a natural moment' },
		],
	},
	{
		id: 'details',
		label: 'Details',
		question: 'What details would make it feel real?',
		chips: [
			{ label: 'Color', text: 'rich color contrast' },
			{ label: 'Texture', text: 'visible texture and fine detail' },
			{ label: 'Light', text: 'soft directional lighting' },
		],
	},
	{
		id: 'direction',
		label: 'Direction',
		question: 'How should the image be composed?',
		chips: [
			{ label: 'Close', text: 'close-up composition' },
			{ label: 'Wide', text: 'wide cinematic composition' },
			{ label: 'Style', text: 'distinct editorial art direction' },
		],
	},
];

const normalizeTerm = ( term ) => term.toLowerCase().replace( /['-]/g, '' );

/**
 * Gets a prompt refinement stage.
 *
 * @param {string} stageId Stage identifier.
 * @return {Object} Matching stage.
 */
export const getRefinementStage = ( stageId ) =>
	REFINEMENT_STAGES.find( ( stage ) => stage.id === stageId ) ||
	REFINEMENT_STAGES[ 0 ];

/**
 * Extracts meaningful prompt terms that can be expanded.
 *
 * @param {string} prompt  Prompt text.
 * @param {number} [limit] Maximum number of terms.
 * @return {Array<Object>} Prompt terms with text and location.
 */
export const extractPromptTerms = ( prompt, limit = 6 ) => {
	const terms = [];
	const seen = new Set();
	const matches = prompt.matchAll( /[A-Za-z][A-Za-z'-]*/g );

	for ( const match of matches ) {
		const text = match[ 0 ];
		const normalized = normalizeTerm( text );

		if (
			normalized.length < 3 ||
			STOP_WORDS.has( normalized ) ||
			seen.has( normalized )
		) {
			continue;
		}

		seen.add( normalized );
		terms.push( {
			id: `${ normalized }-${ match.index }`,
			text,
			normalized,
			start: match.index,
			end: match.index + text.length,
		} );

		if ( terms.length >= limit ) {
			break;
		}
	}

	return terms;
};

/**
 * Gets deterministic expansion choices for a prompt term.
 *
 * @param {string|Object} term Prompt term.
 * @return {string[]} Expansion choices.
 */
export const getTermExpansionChoices = ( term ) => {
	const text = typeof term === 'string' ? term : term?.text || '';

	if ( ! text.trim() ) {
		return [];
	}

	const normalized = normalizeTerm( text );

	if ( TERM_EXPANSIONS[ normalized ] ) {
		return TERM_EXPANSIONS[ normalized ];
	}

	return [
		`vivid ${ text }`,
		`weathered ${ text }`,
		`miniature ${ text }`,
	].filter( ( choice ) => choice.trim() );
};

/**
 * Replaces a selected prompt term with an expansion.
 *
 * @param {string} prompt      Prompt text.
 * @param {Object} term        Selected term from extractPromptTerms.
 * @param {string} replacement Replacement text.
 * @return {string} Updated prompt.
 */
export const replacePromptTerm = ( prompt, term, replacement ) => {
	const safeReplacement = replacement.trim();

	if ( ! prompt || ! term?.text || ! safeReplacement ) {
		return prompt;
	}

	const currentSlice = prompt.slice( term.start, term.end );
	if ( currentSlice.toLowerCase() === term.text.toLowerCase() ) {
		return `${ prompt.slice(
			0,
			term.start
		) }${ safeReplacement }${ prompt.slice( term.end ) }`;
	}

	const termPattern = new RegExp( `\\b${ term.text }\\b`, 'i' );
	return prompt.replace( termPattern, safeReplacement );
};

/**
 * Appends a refinement detail to the prompt.
 *
 * @param {string} prompt Prompt text.
 * @param {string} detail Detail text.
 * @return {string} Updated prompt.
 */
export const appendPromptDetail = ( prompt, detail ) => {
	const safePrompt = prompt.trim();
	const safeDetail = detail.trim();

	if ( ! safeDetail ) {
		return safePrompt;
	}

	if ( ! safePrompt ) {
		return safeDetail;
	}

	const existingDetails = safePrompt
		.toLowerCase()
		.split( ',' )
		.map( ( segment ) => segment.trim() );

	if ( existingDetails.includes( safeDetail.toLowerCase() ) ) {
		return safePrompt;
	}

	return `${ safePrompt.replace( /[,. ]+$/, '' ) }, ${ safeDetail }`;
};
