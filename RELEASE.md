# CAT TERRITORY 1.1.7

Migration release: GitHub becomes the source of truth for Cloudflare Pages deployment. Baseline behavior comes from stable AppDeploy 1.1.6.

## 1.1.7
- Win dialog is intentionally simpler: result summary plus one consistent `Next level` action. Size/rank transition plaques and dynamic `Start N×N` labels are removed.
- Territory colors are assigned per puzzle from the territory adjacency graph. A deterministic DSATUR-style pass maximizes perceptual distance from already colored neighboring territories while preserving the established pastel palette.
- Cat progress paws use the same per-level color assignment as the board.
- Keyboard roving focus starts on an enabled cell and skips native-disabled starter cats in directional navigation.
- PWA cache version bumped to 1.1.7.

## Preserved behavior
Core puzzle rules, Smart Auto-X wave/one-step Undo, three-mistake restart, Hint logic, Daily, Endless generation, scoring, achievements and persistence remain unchanged from 1.1.6.

## Verification target
Run `npm run typecheck`, `npm run build`, then `npm run test:e2e`. Cloudflare Pages build command: `npm run build`; output directory: `dist`.
