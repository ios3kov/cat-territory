export type HapticCue = 'drop' | 'merge' | 'order' | 'fail' | 'restart';

const PATTERNS: Record<HapticCue, number | number[]> = {
  drop: 5,
  merge: [9, 16, 7],
  order: [10, 20, 12, 26, 16],
  fail: [18, 34, 20],
  restart: [7, 18, 7],
};

let lastPulseAt = 0;

export function haptic(cue: HapticCue) {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function' ||
    (typeof document !== 'undefined' && document.visibilityState !== 'visible')
  )
    return false;

  const now = performance.now();
  if (cue === 'drop' && now - lastPulseAt < 80) return false;
  lastPulseAt = now;
  try {
    return navigator.vibrate(PATTERNS[cue]);
  } catch {
    return false;
  }
}
