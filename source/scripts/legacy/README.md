# Legacy verifiers (archived)

`verify.mjs`, `verify-v2.mjs` and `verify-v3.mjs` are kept for reference only. They predate the current UI
and the debug-API gate (`?debug`), so they no longer pass. Use `npm run verify` (scripts/verify-v4.mjs).

## Archived character generators

`chibi/` + `generate_chibi.py` (Q 版 style A) and `generate_characters.py` (older 4×4 fine-pixel sheets) are kept
for reference only. They write to the live `public/assets/sprites/characters/` path, so don't run them; the in-game
sheets now come from `npm run sprites:chars` (`scripts/generate_octo.py`, 方案二 歧路旅人風).
