# AGENTS.md

See the root `AGENTS.md` for global conventions and tooling.

## Scope
- Gutenberg editor UI and block integration.
- Source files build into `build/`, which is committed (do not edit `build/` directly).
- When `src/` changes, rebuild with `npm run build`.

## Key Files
- Entry point: `src/index.js` (block/editor UI).
- UI components: `src/components/`.
- API client logic: `src/api.js`.

## Conventions
- Keep UI logic in `src/`, not `build/`.
- Prefer WordPress data/store APIs and editor utilities where applicable.
