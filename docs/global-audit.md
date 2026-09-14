# CAT TERRITORY — global audit, 2026-09-14

Scope: the released tree at `6c706385c265624f50339e19f16a72f04e80d94f`, with fixes isolated in `fix/global-audit`. This audit does not authorize a deployment.

## Acceptance criteria

Preserve puzzle rules, canonical finish scoring, deterministic territories and difficulty floors. Persist every use of Hint; safely reject damaged local saves; keep pointer, keyboard and assistive activation consistent. Keep all controls and the square board usable on desktop, phone portrait, phone landscape and 320 px screens. Validate core flows, error recovery and accessibility; measure expensive generation and production rendering before making performance changes.

## Findings and fixes

| Finding | Resolution and evidence |
| --- | --- |
| Hint on an untouched board was not saved and could not be restarted | Hint starts the solve timer in both game modes; restart recognizes hint usage. Reload regression verifies persistence. Hint dismissal now depends on board changes rather than timer startup. |
| Invalid timestamps could turn elapsed time into NaN; corrupted starter cells could make a session unplayable | Validate timestamps, starter cats, placed cats and undo history before restoring. Malformed generated metadata is rejected before rendering. |
| Stored statistics accepted invalid data; Journal described flawless wins as Perfect and all 10×10 wins as Moon Run | Validate numeric fields and achievement IDs. Show accurate Flawless and 10×10 labels without inventing historical data. |
| Grid cells lacked row parents; virtual clicks did nothing | Add ARIA rows, support assistive activation, preserve cross-row keyboard movement and prevent edge-arrow page scrolling. Document keyboard controls. |
| Achievement Back button overlapped its heading; nested scrolling lacked keyboard access | Separate navigation and title, strengthen heading hierarchy and make the achievement list focusable. Retain the compact card layout and secret achievement treatment. |
| Rules, progress and Daily secondary text failed contrast checks | Darken the affected text. Axe checks the fully mounted screens after finite animations finish. |
| Failed level generation remained cached and retry could not recover | Clear failed resources on explicit prepare; catch postMessage failures and terminate the worker. Regression simulates failure then successful retry. |
| Uniqueness search dominated hard-level generation | Replace repeated column scans with bit masks, preserving ascending search order, candidate budgets, floors and selected puzzles. Golden region hashes cover two Moon Runs. |
| CI dependency installation was not strictly lockfile based | Use npm ci and retain failure artifacts. Add a repeatable production-browser profiler. |

The first four regression checks failed against the baseline before implementation. Existing gameplay tests cover scoring, paws, sequential Auto-X, one-action Undo, restart, hints, Daily results/streaks, sound wiring, hidden-tab audio recovery and reduced motion.

## Performance evidence

Node CPU sampling attributed roughly three quarters of generator samples to the uniqueness search. Same environment, cold generation, unchanged candidate budgets:

| Level index | Before | After | Logical score |
| --- | ---: | ---: | ---: |
| 24, early generated | 441 ms | 296 ms | 158 |
| 33, Moon Run | 17,729 ms | 7,005 ms | 930 |
| 43, Moon Run | 15,257 ms | 7,318 ms | 960 |

Complete serialized levels at these indices were compared before/after and matched. No persistence-version bump is needed because generation output remains compatible. Difficulty regression also verifies unique, logically solvable late levels at indices 33, 40, 43, 49 and 53.

Local production build, Chromium, localhost network; one measured run per viewport (not field Core Web Vitals):

| Scenario | LCP | CLS | Longest main-thread task | Longest recorded event |
| --- | ---: | ---: | ---: | ---: |
| Desktop, 1280×800 | 216 ms | 0 | none ≥50 ms | 64 ms |
| Phone viewport, 393×851, CPU ×4 slowdown | 292 ms | 0 | 68 ms | 88 ms |

No runtime errors in these runs. Recorded event durations are diagnostic samples, not a statistically valid INP measurement. Main JS is about 95.5 kB gzip; dialog and Daily code remain separate chunks. Hard generation stays in a worker; the existing responsive-worker test exercises a live board while it runs.

Reproduce: `npm ci`, `npx playwright install chromium`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, `npm run profile`. An alternate installed Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. CPU and network conditions change absolute timings.

## Review boundaries and remaining engineering work

- Chromium desktop and Pixel 7 portrait/landscape are automated; 320×568 is covered explicitly. Automated accessibility is not a substitute for real VoiceOver/TalkBack testing. Physical iOS audio quality and Safari behavior remain device checks.
- No backend, authentication or payment path is present. Local progress and telemetry are device-local and not authoritative competitive records. Dependency audit found no reported vulnerabilities; this is not a penetration-test claim.
- `strictNullChecks` and `noImplicitAny` remain disabled in the inherited TypeScript configuration. No standalone lint script is configured. Broad controller decomposition and full strict typing are follow-up architecture work, not needed to fix the reproduced defects.
- Service-worker offline/update lifecycle and cross-tab save coordination need dedicated coverage before claiming seamless offline operation across releases. No service-worker behavior was changed by this patch.
- Hard generation still takes seconds on a cold cache and will be slower on older phones. The fixed worker timeout, loading/error UI and retry path remain necessary.

No main-branch or production change is part of this audit.
