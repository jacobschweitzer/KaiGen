const escapeRegExp = ( text ) => text.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );

const createTermId = ( text, start ) => {
	const slug = text
		.toLowerCase()
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-+|-+$/g, '' );

	return `${ slug || 'term' }-${ start }`;
};

const getEntryText = ( entry ) => {
	if ( typeof entry === 'string' ) {
		return entry;
	}

	return entry?.text || entry?.term || entry?.phrase || '';
};

const getEntryChoices = ( entry ) => {
	if ( ! entry || typeof entry === 'string' ) {
		return [];
	}

	const choices = entry.choices || entry.suggestions || entry.details || [];
	return Array.isArray( choices ) ? choices : [];
};

/**
 * Finds model-returned term text inside the current prompt.
 *
 * @param {string} prompt Prompt text.
 * @param {string} text   Term text returned by the model.
 * @return {Object|null} Prompt term with text and location.
 */
export const findPromptTerm = ( prompt, text ) => {
	const safePrompt = typeof prompt === 'string' ? prompt : '';
	const safeText = typeof text === 'string' ? text.trim() : '';

	if ( ! safePrompt || ! safeText ) {
		return null;
	}

	const escapedText = escapeRegExp( safeText ).replace( /\s+/g, '\\s+' );
	const prefix = /^[A-Za-z0-9]/.test( safeText ) ? '\\b' : '';
	const suffix = /[A-Za-z0-9]$/.test( safeText ) ? '\\b' : '';
	const termPattern = new RegExp(
		`${ prefix }${ escapedText }${ suffix }`,
		'i'
	);
	const match = safePrompt.match( termPattern );

	if ( ! match ) {
		return null;
	}

	return {
		id: createTermId( match[ 0 ], match.index ),
		text: match[ 0 ],
		start: match.index,
		end: match.index + match[ 0 ].length,
	};
};

/**
 * Normalizes prompt refinements returned by a model-backed endpoint.
 *
 * @param {string}       prompt   Prompt text.
 * @param {Object|Array} response Endpoint response.
 * @return {Array<Object>} Prompt terms with model-provided choices.
 */
export const normalizePromptRefinements = ( prompt, response ) => {
	const entries = Array.isArray( response )
		? response
		: response?.terms || response?.refinements || [];

	if ( ! Array.isArray( entries ) ) {
		return [];
	}

	const seenTerms = new Set();
	const seenChoices = new Set();
	const refinements = [];

	for ( const entry of entries ) {
		const term = findPromptTerm( prompt, getEntryText( entry ) );

		if ( ! term || seenTerms.has( term.id ) ) {
			continue;
		}

		const choices = [];

		for ( const choice of getEntryChoices( entry ) ) {
			const text = typeof choice === 'string' ? choice.trim() : '';
			const normalizedText = text.toLowerCase();

			if (
				! text ||
				normalizedText === term.text.toLowerCase() ||
				seenChoices.has( normalizedText )
			) {
				continue;
			}

			seenChoices.add( normalizedText );
			choices.push( text );

			if ( choices.length === 3 ) {
				break;
			}
		}

		if ( ! choices.length ) {
			continue;
		}

		seenTerms.add( term.id );
		refinements.push( {
			...term,
			choices,
		} );
	}

	return refinements.sort( ( first, second ) => first.start - second.start );
};

/**
 * Replaces a selected prompt term with an expansion.
 *
 * @param {string} prompt      Prompt text.
 * @param {Object} term        Selected prompt term.
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

	const currentTerm = findPromptTerm( prompt, term.text );
	if ( ! currentTerm ) {
		return prompt;
	}

	return `${ prompt.slice(
		0,
		currentTerm.start
	) }${ safeReplacement }${ prompt.slice( currentTerm.end ) }`;
};
