# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

KaiGen E2E tests use Playwright + WordPress Playground with HTTP mocking.

## What to Run
- Run all e2e tests: `npm run test:e2e`
- Run single test: `npx playwright test tests/e2e/image-generation.spec.ts`
- Debug: `npm run test:e2e:debug`
- UI mode: `npm run test:e2e:ui`
- Start Playground manually (optional): `npm run playground:start`

## How Tests Work
- Playground is started automatically via Playwright `webServer` config.
- HTTP requests to external providers are mocked via `/tests/http-mock.php`.
- The Playground blueprint `/.github/blueprints/e2e-test.json` enables networking and loads the mock.
- A special prompt `TRIGGER_ERROR_RESPONSE` forces mocked error responses.

## Current Coverage
- Placeholder UI button visibility for the image block.
- Provider data availability in the editor.
- OpenAI image generation flow (mocked) with screenshots.
- Replicate image generation flow (mocked) with screenshots.
- Reference image selection + generation flow.
- Alt text generation for an uploaded image.
- Error handling keeps modal open and allows closing it.
