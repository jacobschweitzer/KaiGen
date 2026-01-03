/**
 * WordPress Playground Playwright configuration.
 * Simple setup for WordPress Playground testing.
 */
/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
const playgroundPort = process.env.PLAYGROUND_PORT || '9400';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

export default defineConfig( {
	testDir: './tests',
	snapshotDir: './tests/__snapshots__',
	outputDir: './tests/test-results',

	/* Individual test timeout */
	timeout: 60_000,

	/* Run tests in files in parallel - disabled to prevent DB connection issues */
	fullyParallel: false,

	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !! process.env.CI,

	/* Retry failed tests once - helps with transient Playground issues */
	retries: process.env.CI ? 2 : 1,

	/* Single worker to prevent database connection issues with Playground's SQLite */
	workers: 1,

	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: process.env.CI ? 'github' : [ [ 'list' ], [ 'html' ] ],

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL for WordPress Playground - use 127.0.0.1 to avoid CORS issues */
		baseURL: `http://127.0.0.1:${ playgroundPort }`,

		/* Disable video and trace recording in CI for performance */
		video: process.env.CI ? 'off' : 'on-first-retry',
		trace: process.env.CI ? 'off' : 'on-first-retry',
		screenshot: process.env.CI ? 'only-on-failure' : 'on',

		actionTimeout: 15_000,
		navigationTimeout: 30_000,
		launchOptions: {
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-dev-shm-usage',
				'--disable-background-networking',
				'--disable-background-timer-throttling',
				'--disable-renderer-backgrounding',
				'--disable-ipc-flooding-protection',
			],
		},
	},

	/* Configure browsers - focus on Chromium only for CI speed */
	projects: [
		{
			name: 'chromium',
			use: {
				...devices[ 'Desktop Chrome' ],
				browserName: 'chromium',
				headless: true,
			},
		},
	],

	/* Start WordPress Playground automatically */
	webServer: skipWebServer
		? undefined
		: {
				command: `npx @wp-playground/cli server --mount=.:/wordpress/wp-content/plugins/kaigen --blueprint=.github/blueprints/e2e-test.json --port=${ playgroundPort }`,
				url: `http://127.0.0.1:${ playgroundPort }`,
				reuseExistingServer: ! process.env.CI,
				timeout: 120_000,
		  },
} );
