# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

## Scope
- Server-side PHP logic and hooks for the plugin.
- REST/AJAX endpoints live here (`register_rest_route`, `wp_ajax_*`).

## Conventions
- Follow WordPress Coding Standards (PHPCS).
- Use doc blocks with `@package` and short function descriptions.
- Sanitize user inputs with `sanitize_text_field()`, `intval()`, `sanitize_key()`, etc.
- Escape outputs with `esc_attr()`, `esc_html()`, `wp_kses_post()`, etc.
- Prefer hooks/filters for provider integration; avoid provider-specific code in shared/base files.

## Common Entry Points
- Look for REST routes and AJAX handlers when changing API behavior.
- Settings storage uses WordPress options (`get_option`, `update_option`).
- When endpoints change, update the matching client calls in `src/api.js`.
- If REST route paths or shapes change (`inc/class-rest-api.php`), update `src/api.js` and any `apiFetch` usage in `src/filters/addBlockEditFilter.js`.
- If provider HTTP endpoints change (`inc/providers/*` or `inc/alt-text/*`), update `tests/http-mock.php` to keep E2E tests aligned.
