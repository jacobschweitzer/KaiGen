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
        // CI-optimized settings
        video: process.env.CI ? 'off' : 'on-first-retry',
        trace: process.env.CI ? 'off' : 'on-first-retry',
        screenshot: process.env.CI ? 'only-on-failure' : 'on',
      },
    },
  ],

  /* No webServer config - WordPress Playground is managed externally */
});
