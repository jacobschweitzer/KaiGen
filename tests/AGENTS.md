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
- When multiple agents may run Playwright at the same time, each agent must use a unique Playground port to avoid sharing or stealing another agent's service. Prefix commands with `PLAYGROUND_PORT=<free-port>` (for example, `PLAYGROUND_PORT=9411 npm run test:e2e`).
- Do not kill port `9400` or a running Playground server unless you started it in the current agent session. If a port is busy, choose a different `PLAYGROUND_PORT`.
