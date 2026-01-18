# AGENTS.md

KaiGen is an AI image generation tool. This WordPress plugin integrates KaiGen into the block editor so users can generate and insert images.

## Folder-Specific Agent Docs
Prefer the nearest folder-specific `AGENTS.md` when one exists.
- `tests/AGENTS.md` (overview for all tests)
- `tests/e2e/AGENTS.md` (E2E specifics)
- `inc/AGENTS.md` (PHP server-side)
- `src/AGENTS.md` (editor UI)

## Build/Test Commands
- Build: `npm run build`
- Lint JavaScript: `npm run lint:js`
- Fix JavaScript: `npm run lint:js:fix` (auto-fixes issues where possible)
- Lint CSS: `npm run lint:css`
- Lint PHP: `npm run lint:php` (requires `composer install` first)
- Fix PHP: `npm run lint:php:fix` (auto-fixes issues where possible)
- Format code: `npm run format`
- After any changeset that is ready to commit, run the relevant tests and linters (see `tests/AGENTS.md` and `tests/e2e/AGENTS.md` for specifics). If tests pass, run linters based on what changed:
  - PHP changes: `npm run lint:php`
  - CSS changes: `npm run lint:css`
  - JS changes: `npm run lint:js`

## Setup
- Install PHP dependencies: `composer install` (required for PHP linting)
- Node deps: `npm install`

## Code Style Guidelines
- Follow WordPress Coding Standards (enforced via PHPCS)
- Use tabs for indentation (except YAML files which use 2 spaces)
- PHP: Use doc blocks with @package and function descriptions
- Sanitize user inputs with WordPress functions like `sanitize_text_field()`
- Escape outputs with `esc_attr()`, `esc_html()`, etc.
- Use hooks/filters for provider integration; avoid provider-specific code in base files.
- Do not change AI model identifiers (image or alt-text) without explicit user approval.
- When creating a PR, keep the title and description plain text without markdown or special formatting.

## Minimal Architecture
- PHP plugin bootstrap: `kaigen.php`
- Server-side logic & hooks: `inc/`
- Gutenberg editor UI: `src/` (built to `build/`)

## Minimal Data Flow
1. User interacts with KaiGen UI in the block editor (`src/`).
2. JS calls server endpoints/hooks in `inc/`.
3. Server calls provider APIs, returns image URL/data.
4. JS inserts/updates the image block in the editor.

## High-Impact Pointers
- REST/AJAX endpoints live in `inc/` (search for `register_rest_route` / `wp_ajax_`).
- Editor UI entrypoints: `src/index.js` (block) and `src/components/` (UI pieces).
- API client logic: `src/api.js`.
- Built artifacts: `build/` (committed; do not edit directly).
- Settings storage: WordPress options (search for `get_option` / `update_option`).

## Common Tasks → Files
- Add/modify UI control: `src/components/` and `src/index.js`.
- Change provider request payload: `src/api.js` and matching server handler in `inc/`.
- Add provider/server integration: `inc/` (new handler + hooks/filters), then expose in `src/`.
- Update settings UI: `src/admin.js`; settings persistence in `inc/`.
- Adjust build outputs: edit `src/` and run `npm run build` (avoid direct edits in `build/`).
- Version update: Update version in `kaigen.php` ("Version: "), readme.txt ("Stable tag: "), and `package.json` ("version"). 
