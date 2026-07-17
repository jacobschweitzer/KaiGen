# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

KaiGen E2E tests use Playwright + WordPress Playground.

## What to Run
- Install E2E dependencies: `npm ci --prefix tests/e2e`
- Run all e2e tests: `npm run test:e2e`
- Run single test file: `npm run test:e2e -- tests/e2e/image-generation.spec.ts`
- Debug: `npm run test:e2e:debug`
- UI mode: `npm run test:e2e:ui`
- Start Playground manually (optional): `PLAYGROUND_PORT=<port> npm run playground:start`
- Multi-agent run: `npm run test:e2e`

## How Tests Work
- Playground is started automatically via Playwright `webServer` config.
- E2E npm scripts choose a free Playground port automatically unless `PLAYGROUND_PORT` is already set.
- MVP tests avoid real provider calls. The Playground blueprint injects image-capable test provider settings for editor UI coverage.

## Multiple Agents
- Playwright uses WordPress Playground as a local service. The E2E npm scripts assign a free `PLAYGROUND_PORT` for each run so parallel agent sessions stay isolated.
- Keep Playwright's configured single worker unless intentionally changing the test architecture; parallelism should come from separate agents on separate ports, not from multiple workers sharing one Playground SQLite instance.
- Do not stop or reuse another agent's Playground process. For normal E2E runs, use `npm run test:e2e` and let the launcher choose a free port.
- If you manually start Playground for debugging, start it with the same unique port you will use for Playwright, for example `PLAYGROUND_PORT=9411 npm run playground:start` and `PLAYGROUND_PORT=9411 PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e`.

## Current Coverage
- Placeholder UI button visibility for empty image blocks.
- MVP editor settings exposed to the block editor.
- Modal controls for prompt, provider, orientation, and reference images.
- Sidebar reference image marking and `/kaigen/v1/reference-images`.
