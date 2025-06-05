# KaiGen E2E Testing with HTTP Mocking

This directory contains end-to-end tests for the KaiGen WordPress plugin with mocked external API calls.

## Overview

The e2e tests use Playwright to test the complete image generation flow without making actual API calls to OpenAI or Replicate. Instead, HTTP requests are intercepted and mocked responses are returned.

## HTTP Mocking Setup

### How it Works

1. **Blueprint Configuration** (`/.github/blueprints/e2e-test.json`):
   - Enables networking in WordPress Playground
   - Copies the HTTP mock to mu-plugins directory
   - Sets `E2E_TESTING` constant for mock activation
   - Activates the KaiGen plugin

2. **HTTP Mock** (`/tests/http-mock.php`):
   - Intercepts requests to external APIs using `pre_http_request` filter
   - Returns mocked responses for:
     - OpenAI image generation endpoint
     - OpenAI image edit endpoint (image-to-image)
     - Replicate prediction creation endpoint
     - Replicate prediction status endpoint
   - Handles error test cases with special prompt "TRIGGER_ERROR_RESPONSE"

### Mocked Endpoints

| Provider | Endpoint | Mock Response |
|----------|----------|---------------|
| OpenAI | `api.openai.com/v1/images/generations` | Returns placeholder image URL |
| OpenAI | `api.openai.com/v1/images/edits` | Returns edited placeholder image URL |
| Replicate | `api.replicate.com/v1/models/*/predictions` | Returns succeeded prediction with image |
| Replicate | `api.replicate.com/v1/predictions/*` | Returns prediction status |

## Running Tests

### With WordPress Playground (Recommended)

```bash
# Start Playground with e2e test blueprint
npx @wp-playground/cli server --mount=.:/wordpress/wp-content/plugins/kaigen --blueprint=.github/blueprints/e2e-test.json --port=9400

# In another terminal, run tests
npm run test:e2e
```

### With wp-env

```bash
# Start wp-env
npm run test:env:start

# Copy mock file to mu-plugins
docker cp tests/http-mock.php $(docker ps -qf "name=wordpress-env"):/var/www/html/wp-content/mu-plugins/

# Run tests
npm run test:e2e
```

## Test Files

- **`image-block.spec.ts`**: Basic tests for image block functionality
- **`image-generation.spec.ts`**: Full image generation flow tests with mocked APIs

## Writing New Tests

When writing new e2e tests that involve API calls:

1. Use descriptive prompts for successful tests
2. Use "TRIGGER_ERROR_RESPONSE" in prompts to test error handling
3. The mock will return appropriate success/error responses based on the URL and prompt

## Debugging

- Check browser console for errors
- Look at WordPress debug.log for mock activity
- Use `npm run test:e2e:debug` to run tests with Playwright inspector
- Screenshots are saved to `tests/test-results/`

## CI Integration

The e2e tests are configured to run in CI with:
- Chromium browser only (for speed)
- GitHub reporter
- No video/trace recording
- Screenshots only on failure

Use `npm run test:e2e:ci` to run tests with CI configuration locally.