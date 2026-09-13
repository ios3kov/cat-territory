export type FinishGrade = 'perfect' | 'clean' | 'secured';
export type ScoreBreakdown={board:number;speed:number;clean:number;independence:number;total:number};
/** @deprecated Placement feedback is internal-only and never rendered. */
export type ScoreFlash = { idx: number; points: number; tier: 1 | 2 | 3; token: number; };
export function getFinishGrade(mistakes: number, usedHint: boolean): FinishGrade { if (mistakes === 0 && !usedHint) return 'perfect'; if (mistakes === 0) return 'clean'; return 'secured'; }
export function getFinishLabel(grade: FinishGrade) { if (grade === 'perfect') return 'Perfect'; if (grade === 'clean') return 'Clean Run'; return 'Territory Secured'; }
/** @deprecated Kept temporarily for controller compatibility; these points are not part of the player's score. */
export function placementScore(size: number, streak: number, mistakes: number, usedHint: boolean) { const momentum = Math.min(5, Math.max(1, streak)); return Math.max(120, size * 46 + momentum * 36 - mistakes * 28 - (usedHint ? 30 : 0)); }
export function getScoreBreakdown(size:number,seconds:number,mistakes:number,usedHint:boolean):ScoreBreakdown{const board=size*size*78,speed=Math.max(0,size*260-seconds*7),clean=mistakes===0?(usedHint?500:950):Math.max(0,360-mistakes*120),independence=usedHint?0:280,total=Math.max(0,Math.round(board+speed+clean+independence));return{board,speed,clean,independence,total}}
export function runScore(size: number, seconds: number, mistakes: number, usedHint: boolean) { return getScoreBreakdown(size,seconds,mistakes,usedHint).total; }
