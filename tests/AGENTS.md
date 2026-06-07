# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

## Scope
- Test utilities, fixtures, and E2E tests.
- E2E tests live in `tests/e2e/`.
- E2E uses WordPress Playground via Playwright `webServer` with blueprint config in `.github/blueprints/e2e-test.json`.

## Key Files
- E2E suite: `tests/e2e/image-generation.spec.ts`
- Output directory: `tests/test-results/` (generated artifacts)

## Running Tests
- Run PHP unit tests: `npm run test:php`
- Run all e2e tests: `npm run test:e2e`
- Run single test: `npx playwright test tests/e2e/image-generation.spec.ts`
- Debug: `npm run test:e2e:debug`
- E2E npm scripts choose a free Playground port automatically.
- To attach Playwright to a manually started Playground server, set both `PLAYGROUND_PORT=<port>` and `PLAYWRIGHT_SKIP_WEBSERVER=1`.
- Do not kill port `9400` or a running Playground server unless you started it in the current agent session. For manual Playground debugging, choose a different `PLAYGROUND_PORT` if your preferred port is busy.
