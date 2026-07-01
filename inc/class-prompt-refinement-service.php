<?php
/**
 * Prompt refinement service for KaiGen.
 *
 * @package KaiGen
 */

namespace KaiGen;

use WP_Error;

/**
 * Coordinates AI Client text generation for prompt refinement choices.
 */
final class Prompt_Refinement_Service {
	/**
	 * Maximum number of terms to return.
	 *
	 * @var int
	 */
	private const MAX_TERMS = 14;

	/**
	 * Maximum number of choices per term.
	 *
	 * @var int
	 */
	private const MAX_CHOICES = 3;

	/**
	 * Handles a prompt refinement request through the WordPress AI Client.
	 *
	 * @param \WP_REST_Request $request The request object.
	 * @return \WP_REST_Response|WP_Error The response or error.
	 */
	public function generate_from_request( $request ) {
		if ( ! function_exists( 'wp_ai_client_prompt' ) ) {
			return new WP_Error(
				'ai_client_unavailable',
				__( 'WordPress AI Client is not available.', 'kaigen' ),
				[ 'status' => 501 ]
			);
		}

		$prompt = trim( (string) $request->get_param( 'prompt' ) );
		if ( '' === $prompt ) {
			return new WP_Error( 'missing_prompt', __( 'Prompt is required.', 'kaigen' ), [ 'status' => 400 ] );
		}

		try {
			$builder           = wp_ai_client_prompt( $this->build_model_prompt( $prompt ) );
			$model_preferences = $this->get_fast_text_model_preferences();

			if ( ! empty( $model_preferences ) ) {
				$builder = $builder->using_model_preference( ...$model_preferences );
			}

			$builder = $builder
				->using_system_instruction(
					'You help people turn image prompts into concrete visual refinement choices. Return only valid JSON.'
				)
				->using_temperature( 0.8 )
				->as_json_response( $this->get_response_schema() );

			if ( ! $builder->is_supported_for_text_generation() ) {
				return new WP_Error(
					'text_generation_not_supported',
					__( 'No configured WordPress AI provider supports prompt refinement.', 'kaigen' ),
					[ 'status' => 400 ]
				);
			}

			$raw_response = $builder->generate_text();
			if ( is_wp_error( $raw_response ) ) {
				return $raw_response;
			}

			$decoded = $this->decode_response( (string) $raw_response );
			if ( is_wp_error( $decoded ) ) {
				return $decoded;
			}

			return rest_ensure_response(
				[
					'terms' => $this->sanitize_refinements( $decoded, $prompt ),
				]
			);
		} catch ( \Throwable $e ) {
			return new WP_Error(
				'prompt_refinement_failed',
				$e->getMessage(),
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Applies a selected refinement choice to the full prompt through the AI Client.
	 *
	 * @param \WP_REST_Request $request The request object.
	 * @return \WP_REST_Response|WP_Error The response or error.
	 */
	public function apply_choice_from_request( $request ) {
		if ( ! function_exists( 'wp_ai_client_prompt' ) ) {
			return new WP_Error(
				'ai_client_unavailable',
				__( 'WordPress AI Client is not available.', 'kaigen' ),
				[ 'status' => 501 ]
			);
		}

		$prompt = trim( (string) $request->get_param( 'prompt' ) );
		$term   = trim( (string) $request->get_param( 'term' ) );
		$choice = trim( (string) $request->get_param( 'choice' ) );

		if ( '' === $prompt || '' === $term || '' === $choice ) {
			return new WP_Error(
				'missing_prompt_refinement_application_data',
				__( 'Prompt, term, and choice are required.', 'kaigen' ),
				[ 'status' => 400 ]
			);
		}

		$term_start = $request->get_param( 'term_start' );
		$term_end   = $request->get_param( 'term_end' );

		try {
			$builder           = wp_ai_client_prompt(
				$this->build_application_model_prompt(
					$prompt,
					$term,
					$choice,
					is_numeric( $term_start ) ? absint( $term_start ) : null,
					is_numeric( $term_end ) ? absint( $term_end ) : null
				)
			);
			$model_preferences = $this->get_fast_text_model_preferences();

			if ( ! empty( $model_preferences ) ) {
				$builder = $builder->using_model_preference( ...$model_preferences );
			}

			$builder = $builder
				->using_system_instruction(
					'You place selected visual details into image prompts. Return only valid JSON.'
				)
				->using_temperature( 0.2 )
				->as_json_response( $this->get_application_response_schema() );

			if ( ! $builder->is_supported_for_text_generation() ) {
				return new WP_Error(
					'text_generation_not_supported',
					__( 'No configured WordPress AI provider supports prompt refinement.', 'kaigen' ),
					[ 'status' => 400 ]
				);
			}

			$raw_response = $builder->generate_text();
			if ( is_wp_error( $raw_response ) ) {
				return $raw_response;
			}

			$decoded = $this->decode_response( (string) $raw_response );
			if ( is_wp_error( $decoded ) ) {
				return $decoded;
			}

			$applied_prompt = $this->sanitize_applied_prompt( $decoded );
			if ( is_wp_error( $applied_prompt ) ) {
				return $applied_prompt;
			}

			return rest_ensure_response(
				[
					'prompt' => $applied_prompt,
				]
			);
		} catch ( \Throwable $e ) {
			return new WP_Error(
				'prompt_refinement_application_failed',
				$e->getMessage(),
				[ 'status' => 500 ]
			);
		}
	}

	/**
	 * Gets fast text model preferences for lightweight prompt suggestions.
	 *
	 * @return array<int, array{string, string}> Provider and model preference tuples.
	 */
	private function get_fast_text_model_preferences() {
		$preferences = [
			[
				'google',
				'gemini-3-flash-preview',
			],
			[
				'google',
				'gemini-2.5-flash',
			],
			[
				'openai',
				'gpt-5.4-mini',
			],
			[
				'openai',
				'gpt-4.1-mini',
			],
		];

		/**
		 * Filters the preferred fast text models for prompt refinement suggestions.
		 *
		 * @param array<int, array{string, string}> $preferences Provider and model tuples.
		 */
		$preferences = apply_filters(
			'kaigen_prompt_refinement_model_preferences',
			$preferences
		);

		if ( ! is_array( $preferences ) ) {
			return [];
		}

		return array_values(
			array_filter(
				$preferences,
				function ( $preference ) {
					return (
						is_array( $preference ) &&
						2 === count( $preference ) &&
						$this->is_model_preference_identifier( $preference[0] ) &&
						$this->is_model_preference_identifier( $preference[1] )
					);
				}
			)
		);
	}

	/**
	 * Checks whether a model preference identifier is safe to pass to the AI Client.
	 *
	 * @param mixed $identifier Provider or model identifier.
	 * @return bool Whether the identifier is valid.
	 */
	private function is_model_preference_identifier( $identifier ) {
		return is_string( $identifier ) && 1 === preg_match( '/^[A-Za-z0-9._-]+$/', $identifier );
	}

	/**
	 * Builds the text-generation prompt sent to the model.
	 *
	 * @param string $prompt User image prompt.
	 * @return string Model prompt.
	 */
	private function build_model_prompt( $prompt ) {
		return implode(
			"\n",
			[
				'Read the whole image prompt and propose contextual refinements.',
				'Return terms from the prompt that would be useful to refine. Use exact text from the prompt for each term.',
				'You may choose single words or natural multi-word phrases. Include short words only when changing them would affect the image.',
				'For each term, return one to three replacement choices that add new visual detail for that term in this prompt.',
				'Every choice must be specific to the full prompt, distinct from the other choices, and useful as replacement text.',
				'Do not simply repeat the surrounding prompt. Do not include explanations or markdown.',
				'Return JSON with this shape: {"terms":[{"text":"exact prompt term","choices":["replacement detail"]}]}',
				'Prompt:',
				wp_json_encode( $prompt ),
			]
		);
	}

	/**
	 * Builds the text-generation prompt for applying a selected refinement.
	 *
	 * @param string   $prompt Original user prompt.
	 * @param string   $term Selected prompt term.
	 * @param string   $choice Selected refinement choice.
	 * @param int|null $term_start Selected term start offset.
	 * @param int|null $term_end Selected term end offset.
	 * @return string Model prompt.
	 */
	private function build_application_model_prompt( $prompt, $term, $choice, $term_start, $term_end ) {
		return implode(
			"\n",
			[
				'Apply one selected detail to an image prompt.',
				'Return one revised prompt that reads naturally.',
				'Preserve the original prompt words, subject, and meaning except for replacing or repositioning the selected term as needed.',
				'Include the selected detail exactly once.',
				'Do not add new visual ideas beyond the selected detail.',
				'Do not remove any original subject or descriptor.',
				'If a direct word replacement would make the grammar confusing, move nearby words so the selected detail modifies the intended subject.',
				'Do not include explanations or markdown.',
				'Return JSON with this shape: {"prompt":"revised image prompt"}',
				'Original prompt:',
				wp_json_encode( $prompt ),
				'Selected term:',
				wp_json_encode( $term ),
				'Selected term start:',
				null === $term_start ? 'null' : (string) $term_start,
				'Selected term end:',
				null === $term_end ? 'null' : (string) $term_end,
				'Selected detail:',
				wp_json_encode( $choice ),
			]
		);
	}

	/**
	 * Gets the JSON schema for prompt refinement output.
	 *
	 * @return array JSON schema.
	 */
	private function get_response_schema() {
		return [
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => [
				'terms' => [
					'type'  => 'array',
					'items' => [
						'type'                 => 'object',
						'additionalProperties' => false,
						'properties'           => [
							'text'    => [
								'type' => 'string',
							],
							'choices' => [
								'type'  => 'array',
								'items' => [
									'type' => 'string',
								],
							],
						],
						'required'             => [ 'text', 'choices' ],
					],
				],
			],
			'required'             => [ 'terms' ],
		];
	}

	/**
	 * Gets the JSON schema for prompt refinement application output.
	 *
	 * @return array JSON schema.
	 */
	private function get_application_response_schema() {
		return [
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => [
				'prompt' => [
					'type' => 'string',
				],
			],
			'required'             => [ 'prompt' ],
		];
	}

	/**
	 * Decodes a model response into an associative array.
	 *
	 * @param string $raw_response Raw model response.
	 * @return array|WP_Error Decoded response or error.
	 */
	private function decode_response( $raw_response ) {
		$json    = trim( $raw_response );
		$decoded = json_decode( $json, true );

		if ( ! is_array( $decoded ) ) {
			$json    = $this->extract_json_object( $json );
			$decoded = null === $json ? null : json_decode( $json, true );
		}

		if ( ! is_array( $decoded ) ) {
			return new WP_Error(
				'invalid_prompt_refinement_response',
				__( 'The AI Client did not return valid prompt refinement JSON.', 'kaigen' ),
				[ 'status' => 500 ]
			);
		}

		return $decoded;
	}

	/**
	 * Extracts the first JSON object from a raw model response.
	 *
	 * @param string $raw_response Raw model response.
	 * @return string|null JSON object or null.
	 */
	private function extract_json_object( $raw_response ) {
		if ( preg_match( '/\{.*\}/s', $raw_response, $matches ) ) {
			return $matches[0];
		}

		return null;
	}

	/**
	 * Sanitizes decoded refinements before returning them to the editor.
	 *
	 * @param array  $decoded Decoded model response.
	 * @param string $prompt Prompt text.
	 * @return array Sanitized terms.
	 */
	private function sanitize_refinements( $decoded, $prompt ) {
		$entries      = isset( $decoded['terms'] ) && is_array( $decoded['terms'] )
			? $decoded['terms']
			: $decoded;
		$terms        = [];
		$seen_terms   = [];
		$seen_choices = [];

		foreach ( $entries as $entry ) {
			if ( count( $terms ) >= self::MAX_TERMS ) {
				break;
			}

			$text = sanitize_text_field( $this->get_entry_text( $entry ) );
			if ( '' === $text || ! $this->term_exists_in_prompt( $text, $prompt ) ) {
				continue;
			}

			$term_key = strtolower( $text );
			if ( isset( $seen_terms[ $term_key ] ) ) {
				continue;
			}

			$choices = [];
			foreach ( $this->get_entry_choices( $entry ) as $choice ) {
				if ( count( $choices ) >= self::MAX_CHOICES ) {
					break;
				}

				$choice = sanitize_text_field( (string) $choice );
				if ( '' === $choice ) {
					continue;
				}

				$choice_key = strtolower( $choice );
				if ( $choice_key === $term_key || isset( $seen_choices[ $choice_key ] ) ) {
					continue;
				}

				$seen_choices[ $choice_key ] = true;
				$choices[]                   = $choice;
			}

			if ( empty( $choices ) ) {
				continue;
			}

			$seen_terms[ $term_key ] = true;
			$terms[]                 = [
				'text'    => $text,
				'choices' => $choices,
			];
		}

		return $terms;
	}

	/**
	 * Sanitizes a decoded applied prompt.
	 *
	 * @param array $decoded Decoded model response.
	 * @return string|WP_Error Sanitized prompt or error.
	 */
	private function sanitize_applied_prompt( $decoded ) {
		$prompt = isset( $decoded['prompt'] ) && is_scalar( $decoded['prompt'] )
			? sanitize_textarea_field( (string) $decoded['prompt'] )
			: '';

		if ( '' === $prompt ) {
			return new WP_Error(
				'invalid_prompt_refinement_application_response',
				__( 'The AI Client did not return a revised prompt.', 'kaigen' ),
				[ 'status' => 500 ]
			);
		}

		return $prompt;
	}

	/**
	 * Gets a term text value from a decoded entry.
	 *
	 * @param mixed $entry Decoded model entry.
	 * @return string Term text.
	 */
	private function get_entry_text( $entry ) {
		if ( is_string( $entry ) ) {
			return $entry;
		}

		if ( ! is_array( $entry ) ) {
			return '';
		}

		foreach ( [ 'text', 'term', 'phrase' ] as $key ) {
			if ( isset( $entry[ $key ] ) && is_scalar( $entry[ $key ] ) ) {
				return (string) $entry[ $key ];
			}
		}

		return '';
	}

	/**
	 * Gets choice strings from a decoded entry.
	 *
	 * @param mixed $entry Decoded model entry.
	 * @return array Choice values.
	 */
	private function get_entry_choices( $entry ) {
		if ( ! is_array( $entry ) ) {
			return [];
		}

		foreach ( [ 'choices', 'suggestions', 'details' ] as $key ) {
			if ( isset( $entry[ $key ] ) && is_array( $entry[ $key ] ) ) {
				return $entry[ $key ];
			}
		}

		return [];
	}

	/**
	 * Checks whether model-returned text exists in the prompt.
	 *
	 * @param string $text Prompt term text.
	 * @param string $prompt Full prompt.
	 * @return bool Whether the term exists in the prompt.
	 */
	private function term_exists_in_prompt( $text, $prompt ) {
		return 1 === preg_match(
			'/\b' . preg_quote( $text, '/' ) . '\b/i',
			$prompt
		);
	}
}
