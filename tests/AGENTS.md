# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

## Scope
- Test utilities, fixtures, and E2E tests.
- E2E tests live in `tests/e2e/`.
- E2E uses WordPress Playground via Playwright `webServer` with blueprint config in `.github/blueprints/e2e-test.json`.

## Key Files
- HTTP mocking: `tests/http-mock.php`
- E2E suite: `tests/e2e/image-generation.spec.ts`
- Output directory: `tests/test-results/` (generated artifacts)

## Running Tests
- Run all e2e tests: `npm run test:e2e`
- Run single test: `npx playwright test tests/e2e/image-generation.spec.ts`
- Debug: `npm run test:e2e:debug`
