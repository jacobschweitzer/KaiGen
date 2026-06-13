const wpScriptsConfig = require( '@wordpress/scripts/config/eslint.config.cjs' );

module.exports = [
	{
		ignores: [
			'**/playwright-report/**',
			'**/blob-report/**',
			'**/tests/test-results/**',
			'**/tests/e2e/test-results/**',
			'**/tests/e2e/__snapshots__/**',
			'**/tests/e2e/screenshots/**',
		],
	},
	...wpScriptsConfig,
];
