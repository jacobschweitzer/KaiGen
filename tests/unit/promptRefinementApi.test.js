import fs from 'fs';
import path from 'path';

const readFile = ( relativePath ) =>
	fs.readFileSync( path.join( __dirname, '../..', relativePath ), 'utf8' );

describe( 'prompt refinement API', () => {
	it( 'registers a prompt-refinements REST endpoint with sanitized prompt input', () => {
		const plugin = readFile( 'kaigen.php' );
		const restApi = readFile( 'inc/class-rest-api.php' );

		expect( plugin ).toContain(
			"require_once __DIR__ . '/inc/class-prompt-refinement-service.php';"
		);
		expect( restApi ).toContain( 'private $prompt_refinement_service;' );
		expect( restApi ).toMatch(
			/register_rest_route\(\s*self::API_NAMESPACE,\s*'\/prompt-refinements'/
		);
		expect( restApi ).toContain(
			"'callback'            => [ $this, 'handle_prompt_refinements_request' ]"
		);
		expect( restApi ).toContain(
			"'sanitize_callback' => 'sanitize_textarea_field'"
		);
	} );

	it( 'registers an apply-prompt-refinement endpoint for model-backed placement', () => {
		const restApi = readFile( 'inc/class-rest-api.php' );

		expect( restApi ).toMatch(
			/register_rest_route\(\s*self::API_NAMESPACE,\s*'\/apply-prompt-refinement'/
		);
		expect( restApi ).toContain(
			"'callback'            => [ $this, 'handle_apply_prompt_refinement_request' ]"
		);
		expect( restApi ).toContain( "'term_start'" );
		expect( restApi ).toContain( "'term_end'" );
		expect( restApi ).toContain(
			"'sanitize_callback' => 'sanitize_textarea_field'"
		);
	} );

	it( 'uses AI Client text generation and validates model-returned JSON', () => {
		const service = readFile( 'inc/class-prompt-refinement-service.php' );

		expect( service ).toContain( 'wp_ai_client_prompt(' );
		expect( service ).toContain( 'as_json_response' );
		expect( service ).toContain( 'is_supported_for_text_generation' );
		expect( service ).toContain( 'generate_text()' );
		expect( service ).toContain( 'json_decode' );
		expect( service ).toContain( 'apply_choice_from_request' );
		expect( service ).toContain(
			'Do not add new visual ideas beyond the selected detail.'
		);
		expect( service ).not.toMatch(
			/STOP_WORDS|TERM_EXPANSIONS|CONTEXTUAL_TERM_EXPANSIONS|yellow duck|specific visual twist|dusty sunlight|vivid/
		);
	} );

	it( 'prefers fast text models only for prompt refinement suggestions', () => {
		const service = readFile( 'inc/class-prompt-refinement-service.php' );
		const imageService = readFile(
			'inc/class-image-generation-service.php'
		);

		expect( service ).toContain( 'using_model_preference' );
		expect( service ).toContain( 'get_fast_text_model_preferences' );
		expect( service ).toContain(
			"'kaigen_prompt_refinement_model_preferences'"
		);
		expect( service ).toContain( "'gemini-3-flash-preview'" );
		expect( service ).toContain( "'gemini-2.5-flash'" );
		expect( service ).toContain( "'gpt-5.4-mini'" );
		expect( service ).toContain( "'gpt-4.1-mini'" );
		expect( imageService ).not.toContain(
			'kaigen_prompt_refinement_model_preferences'
		);
	} );
} );
