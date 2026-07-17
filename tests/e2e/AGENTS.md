# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

KaiGen E2E tests use Playwright + WordPress Playground.

## What to Run
- Run all E2E scenario suites: `npm run test:e2e`
- Run only the base E2E suite: `npm run test:e2e:base`
- Fast smoke check after editor UI changes: `npm run test:e2e:smoke`
- Reference image workflow check: `npm run test:e2e:reference`
- Mocked generation workflow check: `npm run test:e2e:generation`
- Run a single file with the base blueprint: `npm run test:e2e:base -- tests/e2e/image-generation.spec.ts`
- Debug: `npm run test:e2e:debug`
- UI mode: `npm run test:e2e:ui`
- Start Playground manually (optional): `PLAYGROUND_PORT=<port> npm run playground:start`
- Full scenario sweep: `npm run test:e2e:all`

## How Tests Work
- Playground is started automatically via Playwright `webServer` config.
- E2E npm scripts choose a free Playground port automatically unless `PLAYGROUND_PORT` is already set.
- MVP tests avoid real provider calls. The Playground blueprints inject image-capable test provider settings for editor UI coverage.
- Default blueprint: `.github/blueprints/e2e-base.json`.
- Reference media blueprint: `.github/blueprints/e2e-reference-media.json`, provides a `POST /wp-json/kaigen-e2e/v1/reference-media` fixture route for marked/unmarked media.
- Mocked generation blueprint: `.github/blueprints/e2e-generation-mocked.json`, used for deterministic generation success coverage.
- Blueprint-specific server behavior lives in `tests/e2e/fixtures/mu-plugins/`; update those PHP fixtures instead of embedding large PHP strings in blueprint JSON.
- Select a blueprint with `--playground-blueprint=<path>` before normal Playwright args when calling the raw launcher, for example `node scripts/run-e2e.js --playground-blueprint=.github/blueprints/e2e-reference-media.json --grep @reference`.
- Debug a scenario by appending Playwright args to that scenario script, for example `npm run test:e2e:reference -- --debug`.
- Pass `--playground-workers=auto` only for intentional multi-client debugging. Keep Playwright itself single-worker unless the test architecture creates isolated Playground instances.

## Multiple Agents
- Playwright uses WordPress Playground as a local service. The E2E npm scripts assign a free `PLAYGROUND_PORT` for each run so parallel agent sessions stay isolated.
- Keep Playwright's configured single worker unless intentionally changing the test architecture; parallelism should come from separate agents on separate ports, not from multiple workers sharing one Playground SQLite instance.
- Do not stop or reuse another agent's Playground process. For normal E2E runs, use `npm run test:e2e` and let the launcher choose a free port.
- If you manually start Playground for debugging, start it with the same unique port you will use for Playwright, for example `PLAYGROUND_PORT=9411 npm run playground:start` and `PLAYGROUND_PORT=9411 PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e`.
- `npm run playground:start` honors `PLAYGROUND_PORT`, `PLAYGROUND_BLUEPRINT`, and `PLAYGROUND_WORKERS`. If `PLAYGROUND_PORT` is unset, it starts at the first available port at or above `9400`.

## Agent QA Workflow
- Start with the smallest command that covers the change: smoke for generic editor UI, reference for media/reference changes, generation for generate/insert behavior.
- Check `tests/test-results/` after failures for screenshots, traces, and browser output.
- When using an exploratory browser or Playwright MCP, convert any important finding into a deterministic Playwright test before treating it as covered.
- Prefer role/name selectors. Add KaiGen-owned `data-testid` attributes only when WordPress markup is too unstable for accessible selectors.
- Assert the user-visible behavior and one durable state signal when possible, such as REST response shape, block attributes, or attachment meta.

## Current Coverage
- Placeholder UI button visibility for empty image blocks.
- MVP editor settings exposed to the block editor.
- Modal controls for prompt, provider, and orientation.
- Mocked image generation insertion with deterministic media response.
- Sidebar reference image marking and `/kaigen/v1/reference-images`.
