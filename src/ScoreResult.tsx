import type { CompletionSummary } from './useGameController';
import { formatTime } from './game';

export function ScoreResult({ summary }: { summary: CompletionSummary }) {
  const { breakdown: score } = summary;
  const description = `${summary.label}. Score ${summary.score}. Board ${score.board}, speed ${score.speed}, clean play ${score.clean}, no hint ${score.independence}. Time ${formatTime(summary.seconds)}. ${summary.mistakes} mistakes. ${summary.usedHint ? 'Hint used.' : 'No hint used.'}${summary.personalBest ? ' Personal best.' : ''}`;
  return (
    <p
      className="chapter-label completion-summary"
      role="status"
      aria-label={description}
      title={description}
    >
      <span>{summary.label}.</span>
      <strong>{summary.score.toLocaleString('en-US')} pts</strong>
      {summary.personalBest && <span className="completion-best">Best</span>}
    </p>
  );
}
