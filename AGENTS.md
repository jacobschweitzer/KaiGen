# CLAUDE.md

KaiGen is an AI image generation tool. This is a WordPress plugin using KaiGen to facilitate AI image creation inside of the WordPress editor.

## Build/Test Commands
- Build: `npm run build`
- Lint JavaScript: `npm run lint:js`
- Fix JavaScript: `npm run lint:js:fix` (auto-fixes issues where possible)
- Lint CSS: `npm run lint:css`
- Lint PHP: `npm run lint:php` (requires `composer install` first)
- Fix PHP: `npm run lint:php:fix` (auto-fixes issues where possible)
- Format code: `npm run format`
- Run all e2e tests: `npm run test:e2e` (automatically starts WordPress Playground)
- Run single test: `npx playwright test tests/e2e/[test-file].spec.ts`
- Debug tests: `npm run test:e2e:debug`
- Run tests with UI: `npm run test:e2e:ui`
- Start Playground manually (optional): `npm run playground:start`

## Setup
- Install PHP dependencies: `composer install` (required for PHP linting)

## Code Style Guidelines
- Follow WordPress Coding Standards (enforced via PHPCS)
- Use tabs for indentation (except YAML files which use 2 spaces)
- PHP: Use doc blocks with @package and function descriptions
- Sanitize user inputs with WordPress functions like sanitize_text_field()
- Escape outputs with esc_attr(), esc_html(), etc.
- Use hooks and filters to extend functionality for providers, no specific provider code in the base files.

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
- Built artifacts: `build/` (do not edit directly).
- Settings storage: WordPress options (search for `get_option` / `update_option`).

## Common Tasks → Files
- Add/modify UI control: `src/components/` and `src/index.js`.
- Change provider request payload: `src/api.js` and matching server handler in `inc/`.
- Add provider/server integration: `inc/` (new handler + hooks/filters), then expose in `src/`.
- Update settings UI: `src/admin.js`; settings persistence in `inc/`.
- Adjust build outputs: edit `src/` and run `npm run build` (avoid direct edits in `build/`).
