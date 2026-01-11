---
name: kaigen-wordpress-plugin
description: WordPress plugin development skill for KaiGen. Use when editing the KaiGen block editor UI, server hooks, or build/test workflows, especially for changes under src/, inc/, or kaigen.php.
compatibility: Designed for the KaiGen WordPress plugin repo; assumes Node and PHP tooling are available.
metadata:
  author: kaigen
  repo: kaigen/wp-content/plugins/kaigen
---
# KaiGen WordPress Plugin Skill

Use this skill when updating the KaiGen WordPress plugin. It summarizes project structure, build/test commands, and coding conventions so changes follow existing patterns.

## Quick start
1. Read `AGENTS.md` for repo-specific guidance and commands.
2. Identify the change area (block editor UI vs. server hooks vs. settings UI).
3. Implement changes in `src/` or `inc/` and avoid editing `build/` directly.
4. Run tests and linters per `AGENTS.md` after changes are ready.

## Project map
- `kaigen.php`: plugin bootstrap and version header.
- `inc/`: server-side logic, hooks, REST/AJAX endpoints.
- `src/`: editor UI and client logic (build output goes to `build/`).
- `build/`: generated assets (do not edit directly).
- `src/index.js`: block entrypoint; `src/components/`: UI components.
- `src/api.js`: client API requests; coordinate with `inc/` handlers.
- `src/admin.js`: settings UI; settings stored via WordPress options in `inc/`.

## Data flow
1. Editor UI in `src/` sends requests via `src/api.js`.
2. Server handlers in `inc/` call provider APIs and return results.
3. Client inserts/updates image blocks in the editor.

## Commands (from `AGENTS.md`)
- Build: `npm run build`
- Lint JS: `npm run lint:js` / Fix: `npm run lint:js:fix`
- Lint CSS: `npm run lint:css`
- Lint PHP: `npm run lint:php` (requires `composer install`)
- Fix PHP: `npm run lint:php:fix`
- Format: `npm run format`
- E2E: `npm run test:e2e`
- Single e2e: `npx playwright test tests/e2e/[test-file].spec.ts`

## Coding rules
- Use tabs for indentation (except YAML files which use 2 spaces).
- Follow WordPress Coding Standards; include PHP doc blocks with @package and function descriptions.
- Sanitize user input (e.g., `sanitize_text_field()`), escape output (`esc_attr()`, `esc_html()`).
- Use hooks/filters for provider integration; avoid provider-specific logic in base files.

## Common tasks → files
- UI control: `src/components/`, `src/index.js`
- Provider payload: `src/api.js` and matching handler in `inc/`
- Provider integration: add handler/hooks in `inc/`, expose in `src/`
- Settings UI: `src/admin.js`; storage in `inc/`
- Version update: `kaigen.php`, `readme.txt`, `package.json`

## Notes
- `build/` is committed but generated; change `src/` then run `npm run build`.
- After any changeset ready to commit, run `npm run test:e2e` and the relevant linters.
