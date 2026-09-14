export type FinishGrade = 'perfect' | 'clean' | 'secured';
export type ScoreBreakdown = {
  board: number;
  speed: number;
  clean: number;
  independence: number;
  total: number;
};
export function getFinishGrade(
  mistakes: number,
  usedHint: boolean,
): FinishGrade {
  if (mistakes === 0 && !usedHint) return 'perfect';
  if (mistakes === 0) return 'clean';
  return 'secured';
}
export function getFinishLabel(grade: FinishGrade) {
  if (grade === 'perfect') return 'Perfect';
  if (grade === 'clean') return 'Clean Run';
  return 'Territory Secured';
}
export function getScoreBreakdown(
  size: number,
  seconds: number,
  mistakes: number,
  usedHint: boolean,
): ScoreBreakdown {
  const board = size * size * 78,
    speed = Math.max(0, size * 260 - seconds * 7),
    clean =
      mistakes === 0
        ? usedHint
          ? 500
          : 950
        : Math.max(0, 360 - mistakes * 120),
    independence = usedHint ? 0 : 280,
    total = Math.max(0, Math.round(board + speed + clean + independence));
  return { board, speed, clean, independence, total };
}

export function getSolveResult(
  size: number,
  seconds: number,
  mistakes: number,
  usedHint: boolean,
) {
  const grade = getFinishGrade(mistakes, usedHint);
  const breakdown = getScoreBreakdown(size, seconds, mistakes, usedHint);
  return {
    grade,
    label: getFinishLabel(grade),
    score: breakdown.total,
    breakdown,
    seconds,
    mistakes,
    usedHint,
  };
}
export type SolveResult = ReturnType<typeof getSolveResult>;
