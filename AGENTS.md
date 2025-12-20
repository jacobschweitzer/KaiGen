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