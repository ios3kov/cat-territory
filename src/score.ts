export type FinishGrade = 'perfect' | 'clean' | 'secured';
export type ScoreFlash = { idx: number; points: number; tier: 1 | 2 | 3; token: number; };
export function getFinishGrade(mistakes: number, usedHint: boolean): FinishGrade { if (mistakes === 0 && !usedHint) return 'perfect'; if (mistakes === 0) return 'clean'; return 'secured'; }
export function getFinishLabel(grade: FinishGrade) { if (grade === 'perfect') return 'Perfect'; if (grade === 'clean') return 'Clean Run'; return 'Territory Secured'; }
export function placementScore(size: number, streak: number, mistakes: number, usedHint: boolean) { const momentum = Math.min(5, Math.max(1, streak)); return Math.max(120, size * 46 + momentum * 36 - mistakes * 28 - (usedHint ? 30 : 0)); }
export function runScore(size: number, seconds: number, mistakes: number, usedHint: boolean) { const boardValue = size * size * 78; const speedBonus = Math.max(0, size * 260 - seconds * 7); const cleanBonus = mistakes === 0 ? (usedHint ? 500 : 950) : Math.max(0, 360 - mistakes * 120); const independenceBonus = usedHint ? 0 : 280; return Math.max(0, Math.round(boardValue + speedBonus + cleanBonus + independenceBonus)); }
