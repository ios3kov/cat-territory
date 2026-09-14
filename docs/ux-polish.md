# Interaction polish

Scope: two-step first-run coaching, visible hint reasoning, victory hierarchy, compact phone landscape and animation priority. Progress, ranks, scores, generator behavior and persistence keys stay unchanged.

- Coaching ends after a successful mark and cat placement; Skip is always available. Previously completed/advanced coaching states do not restart the introduction.
- Hints retain their source cells when revealing the move. Solid outlines identify the clue, dashed outlines identify eliminations, and a double outline identifies placement. Accessible cell labels describe the same distinction. Memoized highlights avoid timer-driven board updates.
- Victory keeps the happy cat and Next level primary, with the complete score breakdown below (alongside on landscape).
- Landscape groups the board and a bounded control column. Idle body/eye motion pauses while a hint, placement, mistake, coaching or board victory is drawing attention; placement and victory motion remain active. Reduced motion still disables animations.

Audio diagnosis: the unlock listeners handled touchstart/pointerdown but omitted touch release. Touch activation occurs on pointerup/touchend (see https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation). A resume denied at touchstart could leave a pending cue silent until a later gesture. Release/click listeners now retry within that gesture. The existing single-cue age limit and mute handling remain intact.

A source-level simulated gesture regression failed before the fix (context remained suspended), then passed with one cue. Browser tests exercise the same denied-start/accepted-release sequence; they verify scheduling and state, not physical iPhone speaker output. Existing audio recovery tests still cover mute ramps, deferred resume/suspend and closed contexts.

Validation: format, strict typecheck, lint, build, desktop/portrait/landscape gameplay and offline checks. CI additionally runs coaching/hints and audio/motion on WebKit. Physical device listening remains a user-device verification.
