# Victory slide — specification

Goal: keep the completed puzzle visible; replace the four bottom actions with a same-width slide-to-next-level control. No victory modal and no alternate tap/keyboard activation (explicit product decision).

UX: preserve the win sound/celebration, then merge the four button surfaces into a single track. A paw handle starts left. A new pointer must start on the handle, travel right to at least 80%, then release. Short/reversed/cancelled gestures return smoothly. Show score/grade in the existing subtitle line. Load the next puzzle without blanking the completed one, animate it out only when the next puzzle is ready, then restore the normal actions and board assembly. Failure returns the same slider to a retry state.

Architecture: NextLevelSlide owns only the gesture, arming delay, loading/error and local progress. Existing game controller owns level preparation, one-in-flight guard, exit animation and level switch. App composes the action dock. No changes to rules, generation, IDs, scoring, Auto X, Undo, progress or persistence.

Risks/acceptance: no accidental last-tap activation, track clicks or alternate keys; no double progression; no lost-input lock after pointercancel/lost capture/blur/resize; active touch remains captured off the handle; 320px portrait and low-height landscape remain usable; reduced motion has no animation wait; loading/error remain in the track; repeated wins and reload preserve existing progression semantics. Drag-only navigation intentionally does not meet WCAG's non-drag alternative requirement; do not describe it as fully keyboard/screen-reader accessible.

Research: considered https://chanhdai.com/components/slide-to-unlock and https://motion.dev/docs/react-drag. The application currently uses React/lucide only; adding Motion for one control does not simplify the integration/morph/loading ownership. Implement a small original component using the browser pattern documented in https://www.w3.org/TR/pointerevents3/#pointer-capture; no third-party code copied and no added dependencies.

Tasks: (1) record failing public UI regression; (2) implement component and controller transition; (3) remove retired modal/styles, adapt existing win tests; (4) cover threshold/cancel/retry/loading/reduced motion/phone layouts; (5) review, format/lint/typecheck/build, full E2E/WebKit/offline. Keep feature branch unmerged until explicit deployment approval.
