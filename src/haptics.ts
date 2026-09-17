export type HapticCue =
  | 'mark'
  | 'paint'
  | 'erase'
  | 'cat'
  | 'remove'
  | 'mistake'
  | 'strikeout'
  | 'undo'
  | 'hint'
  | 'reveal'
  | 'restart'
  | 'win'
  | 'achievement'
  | 'secretAchievement'
  | 'milestone'
  | 'next';
const PATTERNS: Record<HapticCue, number | number[]> = {
  mark: 4,
  paint: 4,
  erase: 3,
  cat: [9, 18, 7],
  remove: 6,
  mistake: 16,
  strikeout: [20, 34, 20],
  undo: [6, 16, 5],
  hint: 7,
  reveal: [7, 16, 9],
  restart: [10, 18, 8],
  win: [14, 26, 18, 30, 24],
  achievement: [8, 20, 11],
  secretAchievement: [8, 16, 8, 24, 16],
  milestone: [10, 22, 14],
  next: 8,
};
let lastCellPulseAt = 0;
const CELL_PULSE_GAP_MS = 48;
export function haptic(cue: HapticCue) {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  )
    return false;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible')
    return false;
  if (cue === 'mark' || cue === 'paint' || cue === 'erase') {
    const now = performance.now();
    if (now - lastCellPulseAt < CELL_PULSE_GAP_MS) return false;
    lastCellPulseAt = now;
  }
  try {
    return navigator.vibrate(PATTERNS[cue]);
  } catch {
    return false;
  }
}
