/**
 * WordPress Playground Playwright configuration.
 * Simple setup for WordPress Playground testing.
 */
/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  snapshotDir: './tests/__snapshots__',
  outputDir: './tests/test-results',
  
  /* Individual test timeout */
  timeout: 30_000,
  
  /* Run tests in files in parallel - disabled to prevent DB connection issues */
  fullyParallel: false,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry failed tests once - helps with transient Playground issues */
  retries: 1,
  
  /* Single worker to prevent database connection issues with Playground's SQLite */
  workers: 1,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'github' : [['list'], ['html']],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL for WordPress Playground - use 127.0.0.1 to avoid CORS issues */
    baseURL: 'http://127.0.0.1:9400',

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
      },
    },
  ],

  /* Start WordPress Playground automatically */
  webServer: {
    command: 'npm run playground:start',
    url: 'http://127.0.0.1:9400',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
