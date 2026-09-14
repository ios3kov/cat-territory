# Game core refactoring

The deployed audit release is the baseline (`91f26736c7ed1bad2ed0a2e4ff40d3f3ee93a6d8`). This refactor is isolated in `refactor/game-core` and is not a deployment.

## Changes

- Format source, tests, scripts and configuration with a pinned Prettier version. The first PR commit contains only formatting, so subsequent logic changes can be reviewed separately.
- Enable full strict TypeScript. The only newly exposed error was incorrect inferred return narrowing around the generator's recursive solution search; its explicit return type fixes the type model without changing the algorithm.
- Add ESLint recommended JavaScript/TypeScript checks and React Rules of Hooks, with zero warnings allowed. Existing optional-operation catches now explain their fallback; unused assignment and conditional-statement issues are cleaned up.
- Share wall-clock state and interval cleanup in `useGameClock`, preserving hidden-tab elapsed time, restart and restored sessions.
- Share Hint state, reveal feedback and persistent used-Hint tracking in `usePuzzleHints`. Mode-specific text and telemetry remain with the controllers.
- Share the 2.2-second restart confirmation lifecycle in `useRestartConfirmation`.
- Calculate each completion's score breakdown once through `getSolveResult`, used for Endless, Daily completion and restored Daily results.
- Move Daily state and event handling into `useDailyController`; `DailyTerritory` renders the view. Board gestures, Auto-X, snapshots and paw ordering keep their existing shared implementations.

## Validation

Run `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e` and `npm run test:offline`. All gates run in CI. Browser installation: `npx playwright install --with-deps chromium webkit`.

The existing gameplay suite covers desktop, portrait, landscape, both modes, completion/scoring, Hint persistence, Undo, paw colors, Auto-X, sound, focus and reduced motion. Six additional browser cases verify the shared clock across hidden time and reset, and restart-confirmation expiry in both modes. The offline suite continues to test complete releases and update rollback on Chromium and WebKit.

Local validation passed 94 existing gameplay cases, six new lifecycle cases and nine Chromium offline cases. Two duplicate generator runs remain intentionally skipped. WebKit runs in CI. The generator worker content hash is unchanged; main JavaScript remains about 96 kB gzip and Daily remains a separate lazy chunk.

## Boundaries

This is incremental decomposition, not a new game engine. Mode-specific mistake handling, victory timing, achievements and Daily streak effects remain in their controllers because they have different behavior. Full React exhaustive-dependency linting, physical iPhone/VoiceOver testing and cross-tab gameplay-write conflict resolution are not claimed by these checks. No gameplay balance, scoring formula, save keys or visual redesign is intended.
