import { getRankMeta } from './ranks';
import { storageGet, storageSet } from './storage';
const KEY = 'cat-territory-achievements-v2';
export type PlayerStats = {
  completed: number;
  flawless: number;
  noHint: number;
  nineByNine: number;
  tenByTen: number;
  fastest8: number | null;
  fastest9: number | null;
  fastest10: number | null;
  bestBySize: Record<string, number>;
  currentFlawlessStreak: number;
  bestFlawlessStreak: number;
  apexRuns: number;
};
export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: string;
  secret?: boolean;
};
const empty = (): PlayerStats => ({
  completed: 0,
  flawless: 0,
  noHint: 0,
  nineByNine: 0,
  tenByTen: 0,
  fastest8: null,
  fastest9: null,
  fastest10: null,
  bestBySize: {},
  currentFlawlessStreak: 0,
  bestFlawlessStreak: 0,
  apexRuns: 0,
});
const defs = [
  ['first', 'First Territory', 'Complete your first level.', '🐾', 1],
  ['ten', 'House Cat', 'Complete 10 levels.', '🏠', 10],
  ['clean', 'Clean Paws', 'Finish a level with no mistakes.', '✨', 0],
  ['instinct', 'Pure Instinct', 'Finish a level without using Hint.', '🧠', 0],
  ['big-cat', 'Big Cat Energy', 'Complete a 10×10 level.', '🐯', 0],
  ['apex', 'Apex Cat', 'Clear a 10×10 with no mistakes and no Hint.', '👑', 0],
] as const;
function read(): { stats: PlayerStats; unlocked: string[] } {
  const stats = empty();
  try {
    const parsed = JSON.parse(storageGet(KEY) ?? '{}');
    const saved = parsed?.stats;
    const nonnegative = (value: unknown): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(stats) as (keyof PlayerStats)[]) {
        if (key === 'bestBySize') continue;
        if (nonnegative(saved[key]))
          Object.assign(stats, { [key]: Math.floor(saved[key]) });
      }
      for (const size of ['5', '6', '7', '8', '9', '10'])
        if (nonnegative(saved.bestBySize?.[size]))
          stats.bestBySize[size] = Math.floor(saved.bestBySize[size]);
    }
    const unlocked = Array.isArray(parsed?.unlocked)
      ? parsed.unlocked.filter((id: unknown) =>
          defs.some((def) => def[0] === id),
        )
      : [];
    return { stats, unlocked };
  } catch {
    return { stats, unlocked: [] };
  }
}
function evaluate(data: ReturnType<typeof read>) {
  const u = new Set(data.unlocked);
  if (data.stats.completed >= 1) u.add('first');
  if (data.stats.completed >= 10) u.add('ten');
  if (data.stats.flawless >= 1) u.add('clean');
  if (data.stats.noHint >= 1) u.add('instinct');
  if (data.stats.tenByTen >= 1) u.add('big-cat');
  if (data.stats.apexRuns >= 1) u.add('apex');
  const fresh = [...u].filter((id) => !data.unlocked.includes(id));
  data.unlocked = [...u];
  storageSet(KEY, JSON.stringify(data));
  return fresh;
}
export function getPlayerRank(completed: number) {
  return getRankMeta(completed);
}
export function syncAchievementProgress(completed: number) {
  const d = read();
  d.stats.completed = Math.max(d.stats.completed, completed);
  evaluate(d);
}
export function recordLevelCompletion(input: {
  levelIndex: number;
  size: number;
  seconds: number;
  mistakes: number;
  usedHint: boolean;
}) {
  const d = read();
  d.stats.completed = Math.max(d.stats.completed, input.levelIndex + 1);
  if (input.mistakes === 0) {
    d.stats.flawless++;
    d.stats.currentFlawlessStreak++;
    d.stats.bestFlawlessStreak = Math.max(
      d.stats.bestFlawlessStreak,
      d.stats.currentFlawlessStreak,
    );
  } else d.stats.currentFlawlessStreak = 0;
  if (!input.usedHint) d.stats.noHint++;
  if (input.size === 9) d.stats.nineByNine++;
  if (input.size === 10) d.stats.tenByTen++;
  const key = String(input.size),
    old = d.stats.bestBySize[key];
  d.stats.bestBySize[key] =
    old === undefined ? input.seconds : Math.min(old, input.seconds);
  if (input.size === 8)
    d.stats.fastest8 =
      d.stats.fastest8 === null
        ? input.seconds
        : Math.min(d.stats.fastest8, input.seconds);
  if (input.size === 9)
    d.stats.fastest9 =
      d.stats.fastest9 === null
        ? input.seconds
        : Math.min(d.stats.fastest9, input.seconds);
  if (input.size === 10)
    d.stats.fastest10 =
      d.stats.fastest10 === null
        ? input.seconds
        : Math.min(d.stats.fastest10, input.seconds);
  if (input.size === 10 && input.mistakes === 0 && !input.usedHint)
    d.stats.apexRuns++;
  const fresh = evaluate(d);
  return getAchievementSnapshot().filter((i) => fresh.includes(i.id));
}
export function getPlayerStats() {
  const s = read().stats;
  return { ...s, bestBySize: { ...s.bestBySize } };
}
export function getBestTimeForSize(size: number) {
  return read().stats.bestBySize[String(size)] ?? null;
}
export function getTerritoryJournal() {
  const s = read().stats;
  return [
    { id: 'perfect', label: 'Flawless', icon: '✨', value: s.flawless },
    { id: 'no-hint', label: 'No Hint', icon: '🧠', value: s.noHint },
    { id: 'moon-run', label: '10×10', icon: '🌙', value: s.tenByTen },
    { id: 'apex', label: 'Apex', icon: '👑', value: s.apexRuns },
  ];
}
export function getAchievementSnapshot(): Achievement[] {
  const d = read(),
    u = new Set(d.unlocked);
  return defs.map(([id, title, description, icon, target]) => ({
    id,
    title: id === 'apex' && !u.has(id) ? 'Secret achievement' : title,
    description:
      id === 'apex' && !u.has(id)
        ? 'Keep mastering the largest territories.'
        : description,
    icon: id === 'apex' && !u.has(id) ? '❔' : icon,
    unlocked: u.has(id),
    progress:
      target > 1
        ? `${Math.min(d.stats.completed, target)}/${target}`
        : undefined,
    secret: id === 'apex',
  }));
}
