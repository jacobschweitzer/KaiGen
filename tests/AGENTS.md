# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

## Scope
- Test utilities, fixtures, and E2E tests.
- E2E tests live in `tests/e2e/`.
- E2E uses WordPress Playground via Playwright `webServer` with blueprint config selected by `PLAYGROUND_BLUEPRINT` or `--playground-blueprint`.

## Key Files
- E2E suite: `tests/e2e/image-generation.spec.ts`
- E2E blueprints: `.github/blueprints/e2e-base.json`, `.github/blueprints/e2e-reference-media.json`, `.github/blueprints/e2e-generation-mocked.json`
- E2E MU-plugin fixtures copied by blueprints: `tests/e2e/fixtures/mu-plugins/`
- Output directory: `tests/test-results/` (generated artifacts)

## Running Tests
- Run PHP unit tests: `npm run test:php`
- Run the base e2e suite: `npm run test:e2e` (excludes scenario-only `@reference` and `@generation` tests)
- Run all e2e scenario suites: `npm run test:e2e:all`
- Fast smoke check: `npm run test:e2e:smoke`
- Reference image check with the reference-media blueprint: `npm run test:e2e:reference`
- Mocked generation check: `npm run test:e2e:generation`
- Run single e2e file: `npm run test:e2e -- tests/e2e/image-generation.spec.ts`
- Debug: `npm run test:e2e:debug`
- E2E npm scripts choose a free Playground port automatically.
- To attach Playwright to a manually started Playground server, set both `PLAYGROUND_PORT=<port>` and `PLAYWRIGHT_SKIP_WEBSERVER=1`.
- To run a scenario blueprint without relying on shell env syntax, use its npm script or call the launcher directly, for example `node scripts/run-e2e.js --playground-blueprint=.github/blueprints/e2e-reference-media.json --grep @reference`.
- Do not kill port `9400` or a running Playground server unless you started it in the current agent session. For manual Playground debugging, choose a different `PLAYGROUND_PORT` if your preferred port is busy.
