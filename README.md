# CAT TERRITORY

Mobile-first endless logic puzzle built with React, TypeScript and Vite.

## Architecture

- `useGameController.ts` owns game/session state and progression.
- `useBoardGestures.ts` owns pointer, swipe and double-tap interaction.
- `logicalEngine.ts` and `puzzleEngine.ts` provide deterministic puzzle logic.
- `levelWorker.ts` generates later levels off the main thread.
- `GameBoard.tsx` renders the accessible grid and visual feedback.
- `serviceWorker.js` + `serviceWorkerUpdates.ts` provide offline support and safe automatic updates.
- Local session persistence restores an interrupted level, including Undo history.

## Development

```sh
npm ci
npm run dev
```

## Production verification

The release gate is intentionally stricter than a local build:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run security:check
npx playwright install --with-deps chromium webkit
npm run test:e2e
npm run test:feedback:webkit
npm run test:offline
npm run profile:check
npm run audit:prod
```

The Playwright matrix covers desktop, mobile portrait, mobile landscape and WebKit/iPhone profiles. The performance gate also profiles a CPU-throttled 10×10 level.

## Deployment

Cloudflare Pages builds `main` with `npm run build` and publishes `dist`.

The app checks for a new Service Worker on cold start and after returning to the foreground when at least six hours have elapsed since the previous check. A downloaded update waits for a safe interaction boundary, flushes the active session, activates, reloads and restores gameplay.
