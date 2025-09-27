# Project Architecture

This document provides an overview of the project's architecture and development guidelines.

## File Structure

The project is organized into the following directories:

- `assets/`: Contains static assets like images, stylesheets, and fonts.
- `build/`: This directory contains the compiled and minified assets for the plugin. These files are generated from the `src/` directory. **Do not edit files in this directory directly.**
- `inc/`: Includes PHP files that are part of the plugin's core functionality.
- `playwright/`: Contains the end-to-end tests for the project, written using Playwright.
- `src/`: Contains the source code for the project's JavaScript and CSS files.
  - `components/`: Contains reusable JavaScript components.
  - `filters/`: Contains JavaScript files related to filtering functionality.
  - `admin.js`: Main JavaScript file for the admin area.
  - `api.js`: JavaScript file for handling API requests.
  - `index.js`: Main entry point for JavaScript.
- `tests/`: Contains the test suite for the project.
  - `e2e/`: Contains end-to-end tests.
  - `http-mock.php`: A script for mocking HTTP requests during testing.
- `kaigen.php`: The main plugin file for the WordPress plugin.
- `package.json`: Defines the project's dependencies and scripts.
- `playwright.config.ts`: Configuration file for Playwright tests.
- `uninstall.php`: Script that runs when the plugin is uninstalled.

## End-to-End (E2E) Testing

This project uses Playwright for end-to-end testing. To run the tests, follow these steps:

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start the Test Environment:**
    This will start a local WordPress instance using `@wordpress/env`.
    ```bash
    npm run test:env:start
    ```

3.  **Run the E2E Tests:**
    ```bash
    npm run test:e2e
    ```
    You can also run tests in other modes:
    - **UI Mode:** `npm run test:e2e:ui`
    - **Debug Mode:** `npm run test:e2e:debug`

4.  **Stop the Test Environment:**
    Once you are finished with testing, stop the WordPress instance.
    ```bash
    npm run test:env:stop
    ```

## Development Workflow

As an AI developer, you are expected to follow this workflow:

1.  **Understand the Task:** Before writing any code, make sure you have a clear understanding of the task requirements.

2.  **Code Iteration:** Implement the required changes or features.

3.  **Run Tests:** After each major code iteration, you **must** run the relevant tests to ensure that your changes have not broken existing functionality and that the new feature works as expected.
    - If a test for the feature you are working on exists, run it.
    - If a test does not exist, you must create a new test for the feature.

4.  **Analyze Test Results:**
    - **If tests pass:** Continue with the next development step.
    - **If tests fail:**
        - **Analyze the failure:** Determine if the failure is due to a bug in your code or an issue with the test itself.
        - **Fix the code:** If the failure is due to a bug in your code, fix the bug and re-run the tests.
        - **Update the test:** If the test is outdated or incorrect, update the test to reflect the new changes and re-run the tests.

5.  **Repeat:** Continue this cycle of coding, testing, and fixing until the task is complete.