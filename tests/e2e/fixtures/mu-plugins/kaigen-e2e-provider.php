<?php
/**
 * Supplies image-capable providers for KaiGen E2E tests.
 *
 * @package KaiGen
 */

add_filter(
	'block_editor_settings_all',
	function ( $settings ) {
		if ( ! defined( 'E2E_TESTING' ) || ! E2E_TESTING ) {
			return $settings;
		}

		$settings['kaigen_settings']['provider']               = 'auto';
		$settings['kaigen_settings']['orientation']            = 'square';
		$settings['kaigen_settings']['is_ai_client_available'] = true;
		$settings['kaigen_settings']['providers']              = [
			[
				'id'                  => 'auto',
				'name'                => 'Auto',
				'referenceImageLimit' => 5,
			],
			[
				'id'                  => 'e2e-alpha',
				'name'                => 'E2E Alpha',
				'referenceImageLimit' => 5,
			],
			[
				'id'                  => 'e2e-beta',
				'name'                => 'E2E Beta',
				'referenceImageLimit' => 5,
			],
		];

		return $settings;
	},
	30
);
