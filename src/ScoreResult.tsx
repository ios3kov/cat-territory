import type { ScoreBreakdown } from './score';
export function ScoreResult({ breakdown }: { breakdown: ScoreBreakdown }) {
  const rows = [
    ['Board', breakdown.board],
    ['Speed', breakdown.speed],
    ['Clean play', breakdown.clean],
    ['No hint', breakdown.independence],
    ['Total', breakdown.total],
  ] as const;
  return (
    <div className="score-result">
      <p className="eyebrow">SCORE</p>
      <dl>
        {rows.map(([label, value]) => (
          <div
            key={label}
            className={label === 'Total' ? 'score-total' : undefined}
          >
            <dt>{label}</dt>
            <dd>{value.toLocaleString('en-US')}</dd>
          </div>
        ))}
      </dl>
      <p className="score-explanation">
        Faster solves score more. Mistakes reduce the clean bonus. Hint lowers a
        flawless bonus and removes the no-hint bonus.
      </p>
    </div>
  );
}
