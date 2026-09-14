# Audio and cat feedback follow-up

Changes build on the strict, formatted game-core refactor and remain in PR #6 until separately approved for deployment.

## Reproduced audio defects

- A fast mute/unmute could leave a scheduled fade to zero: the old code tested the current gain before restoring it. Volume changes now cancel scheduled ramps explicitly.
- First-success unlock listeners were removed, leaving later OS interruptions without gesture-time recovery. Lightweight gesture listeners remain installed and resume only when necessary.
- Returning to the tab before its asynchronous suspend finished could leave audio suspended while visible. Completion now rechecks visibility and resumes.
- Closed contexts are recreated. Pending resume keeps only one recent cue, clears it on mute/hidden state, and avoids replaying a backlog. Silent unlock nodes disconnect when finished.

`audioOutput.ts` owns these lifecycle rules; `audio.ts` retains the existing sound recipes and mark/erase throttle. No extra placement sounds or Auto-X sound loop was introduced. Regression tests fail on the previous implementation and pass with the fixes.

## Visual changes

The ten display colors have stronger chroma. Their minimum pairwise CIELAB distance rises from about 16.06 to 19.75 (23%). Reference assignment coordinates preserve existing region-to-palette slots; paws use that same map. This metric does not claim universal color-vision accessibility.

Board cats now have four staggered body motions (curious tilt, stretch, sway and nod), plus blink/look/ear details. Large touch boards keep body animation, with secondary details disabled to limit work. Both result screens explicitly animate their happy cat. Reduced motion disables these animations; hidden pages pause them. Animation uses CSS transforms without JavaScript animation timers or state updates.

## Verification

Format, lint, strict typecheck and build pass locally. The Chromium suite passes 118 cases with two intentional duplicate-generator skips; nine offline cases pass locally. Screenshots were reviewed on desktop, portrait and landscape. Existing tests continue to check paw order/color, Undo, restart, Hint, scoring, focus, contrast and Auto-X. The 10×10 scenario also verifies active idle motion on touch devices. CI additionally runs the new audio/motion tests on WebKit portrait/landscape and the full offline matrix.

A local production-build profile recorded desktop LCP 120 ms and mobile viewport/4× CPU LCP 280 ms, CLS zero in both, no runtime errors. The mobile sample contained one 87 ms long task. These are diagnostic samples, not field performance guarantees. Main JS is about 96.1 kB gzip; the generator worker hash is unchanged.

Physical device audio output, silent-mode behavior and subjective sound quality cannot be established by mocked interruption tests. A real iPhone listening check remains useful before release.
