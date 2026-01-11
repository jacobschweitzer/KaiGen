# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

## Scope
- Gutenberg editor UI, block, and settings UI.
- Source files build into `build/`, which is committed (do not edit `build/` directly).
- When `src/` changes, rebuild with `npm run build`.

## Key Files
- Entry points: `src/index.js` (block) and `src/admin.js` (settings UI).
- UI components: `src/components/`.
- API client logic: `src/api.js`.

## Conventions
- Keep UI logic in `src/`, not `build/`.
- Prefer WordPress data/store APIs and editor utilities where applicable.
- Keep provider-specific logic centralized (avoid scattering across components).
- If admin settings field IDs/names change in `inc/class-admin.php`, update selectors in `src/admin.js`.
