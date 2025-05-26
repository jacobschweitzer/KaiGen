# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Test Commands
- Build: `npm run build`
- Lint JavaScript: `npm run lint:js`
- Lint CSS: `npm run lint:css`
- Format code: `npm run format`
- Run all e2e tests: `npm run test:e2e`
- Run single test: `npx playwright test tests/e2e/[test-file].spec.ts`
- Debug tests: `npm run test:e2e:debug`
- Run tests with UI: `npm run test:e2e:ui`

## Code Style Guidelines
- Follow WordPress Coding Standards
- Use tabs for indentation (except YAML files which use 2 spaces)
- PHP: Classes use class-prefix.php naming convention
- PHP: Use doc blocks with @package and function descriptions
- JavaScript: Use JSX for components
- Sanitize user inputs with WordPress functions like sanitize_text_field()
- Escape outputs with esc_attr(), esc_html(), etc.
- PHP class prefix: KaiGen_
- Use hooks and filters to extend functionality