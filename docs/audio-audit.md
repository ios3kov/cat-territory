# Audio lifecycle audit

Scope: cold first gesture, device startup, mute persistence, hidden/visible transitions, interrupted/closed contexts, pending cue ordering, mark throttling and all 19 sound recipes. No UI or gameplay changes.

## Findings and fixes

1. Recovery tests previously warmed audio with a keyboard gesture before every test. They now start cold; tests requiring a warm session initialize it explicitly. Real first board gestures are checked separately.
2. Cold contexts were constructed during touchstart/pointerdown before touch activation. Mouse press and keyboard activation remain immediate; touch now constructs its context on release. A first swipe can queue one cue before release.
3. A 350 ms expiry discarded the first cue when initial resume took longer. Cold startup now allows up to 1500 ms; established sessions retain the 350 ms limit. Only the latest cue is retained, with no backlog or retry timers.
4. If the page hid before initial resume completed, the subsequently running context was not suspended. Both resume completion and visibility changes use the same suspend/return handling.
5. During review of pending-resume gating, a regression test caught a cue queued between the resume callback and its continuation. The continuation now flushes it after clearing the in-flight state.

The first two cold-start scenarios, hidden-during-startup scenario and resume-settling scenario failed before their respective fixes and pass afterward. Browser tests use simulated device latency and state; they cannot verify the physical iPhone speaker or Bluetooth output.

## Wiring review

- Marks and erasures share a 34 ms throttle. Auto-X is explicitly excluded from sound dispatch.
- Correct placement has one correct cue. Wrong placement selects mistake or strikeout, not both. Removing a cat has its own cue.
- Hint, reveal, Undo, confirmed restart and next-level transition each have an explicit call site.
- Victory, achievement/secret achievement and rank/Moon Run are distinct events. Their timers retain cleanup; no new timers were introduced by this change.
- UI open/close and enabling sound use their existing cues. Muting clears pending sound and cancels the gain ramp.
- Every oscillator has a scheduled stop and disconnects itself and its envelope on completion. Silent priming nodes disconnect on completion.
- Tests cover all 19 recipes, repeated unlock installation, cold saved mute, slow startup, expired/cancelled cues, interruptions and replacement of closed contexts.

Reference for activation timing: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/User_activation. The distinction between mouse pointerdown and touch pointerup/touchend is why adding more touchstart listeners is insufficient.

Validation: strict TypeScript, lint, formatter, production build, full gameplay suite on desktop/portrait/landscape, audio/UX WebKit suite and offline upgrade/reload suite. Physical first-tap listening remains a device verification; no claim of having heard the user's iPhone.
