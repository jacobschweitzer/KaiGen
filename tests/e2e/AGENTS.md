# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

KaiGen E2E tests use Playwright + WordPress Playground.

## What to Run
- Run all e2e tests: `npm run test:e2e`
- Run single test: `npx playwright test tests/e2e/image-generation.spec.ts`
- Debug: `npm run test:e2e:debug`
- UI mode: `npm run test:e2e:ui`
- Start Playground manually (optional): `npm run playground:start`
- Multi-agent run: `PLAYGROUND_PORT=<free-port> npm run test:e2e`

## How Tests Work
- Playground is started automatically via Playwright `webServer` config.
- MVP tests avoid provider-specific HTTP mocks. Core AI generation behavior should be covered once the WordPress AI Client test harness can provide a configured image-capable provider.

## Multiple Agents
- Playwright uses WordPress Playground as a local service. When more than one agent may test at the same time, assign each agent a unique `PLAYGROUND_PORT` so runs are isolated and consistent.
- Keep Playwright's configured single worker unless intentionally changing the test architecture; parallelism should come from separate agents on separate ports, not from multiple workers sharing one Playground SQLite instance.
- Do not stop or reuse another agent's Playground process. If the default port `9400` is busy, choose another free port instead of killing the process.
- If you manually start Playground for debugging, start it with the same unique port you will use for Playwright, for example `PLAYGROUND_PORT=9411 npm run playground:start` and `PLAYGROUND_PORT=9411 PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e`.

## Current Coverage
- Placeholder UI button visibility for empty image blocks.
- MVP editor settings exposed to the block editor.
- Modal controls for prompt, provider, orientation, and reference images.
- Sidebar reference image marking and `/kaigen/v1/reference-images`.
