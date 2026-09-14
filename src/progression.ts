import { getRankMeta } from './ranks';
export type ProgressionMeta = {
  rank: string;
  run: number | null;
  runName: string | null;
  special: boolean;
};
const RUN_NAMES = [
  'Night Prowl',
  'Window Watch',
  'Velvet Trail',
  'Rooftop Route',
  'Moonlit Path',
  'Quiet Circuit',
] as const;
export function getEndlessRunName(run: number | null) {
  if (!run) return null;
  return RUN_NAMES[(run - 1) % RUN_NAMES.length];
}
export function getRank(levelIndex: number) {
  const completedLevels = Math.max(0, Math.floor(levelIndex));
  return getRankMeta(completedLevels).title;
}
export function getEndlessRun(levelIndex: number) {
  if (levelIndex < 24) return null;
  return Math.floor((levelIndex - 24) / 10) + 1;
}
export function isMoonRun(levelIndex: number) {
  return levelIndex >= 24 && (levelIndex - 24 + 1) % 10 === 0;
}
export function getProgressionMeta(levelIndex: number): ProgressionMeta {
  const run = getEndlessRun(levelIndex);
  return {
    rank: getRank(levelIndex),
    run,
    runName: getEndlessRunName(run),
    special: isMoonRun(levelIndex),
  };
}
export function getTransitionNote(currentIndex: number, nextIndex: number) {
  const currentRank = getRank(currentIndex);
  const nextRank = getRank(nextIndex);
  if (currentRank !== nextRank) return `Rank up · ${nextRank}`;
  if (isMoonRun(nextIndex))
    return `Special territory · Moon Run ${getEndlessRun(nextIndex)}`;
  return undefined;
}
