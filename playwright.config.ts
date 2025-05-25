/**
 * WordPress-specific Playwright configuration.
 */
/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  snapshotDir: './tests/__snapshots__',
  outputDir: './tests/test-results',
  
  /* Individual test timeout */
  timeout: 30_000,
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only - fail fast with minimal retries */
  retries: process.env.CI ? 1 : 0,
  
  /* Optimized workers for CI performance */
  workers: process.env.CI ? 2 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'github' : 'html',
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:8889',

    /* Disable video and trace recording in CI for performance */
    video: process.env.CI ? 'off' : 'on-first-retry',
    trace: process.env.CI ? 'off' : 'on-first-retry',
    screenshot: process.env.CI ? 'only-on-failure' : 'on',
  },

  /* Configure browsers - focus on Chromium only for CI speed */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        headless: true,
        // CI-optimized settings
        video: process.env.CI ? 'off' : 'on-first-retry',
        trace: process.env.CI ? 'off' : 'on-first-retry',
        screenshot: process.env.CI ? 'only-on-failure' : 'on',
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'wp-env start',
    url: 'http://localhost:8889',
    reuseExistingServer: true,
    timeout: 120000, // Increased timeout for WordPress startup
  },
});
