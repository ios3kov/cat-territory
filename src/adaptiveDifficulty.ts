import { storageGet, storageSet } from './storage';

export const ADAPTIVE_DIFFICULTY_KEY = 'cat-territory-adaptive-difficulty-v1';
const KEY = ADAPTIVE_DIFFICULTY_KEY;
const WINDOW = 10;

export type AdaptiveResult = {
  size: number;
  seconds: number;
  mistakes: number;
  usedHint: boolean;
  undos: number;
};

type StoredResult = AdaptiveResult & { pace: number };
type Direction = -1 | 0 | 1;
type Profile = {
  offset: number;
  direction: Direction;
  streak: number;
  recent: StoredResult[];
};

const emptyProfile = (): Profile => ({
  offset: 0,
  direction: 0,
  streak: 0,
  recent: [],
});

const finiteNonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function clampOffset(value: number) {
  return Math.max(-2, Math.min(1, Math.trunc(value)));
}

function validResult(value: unknown): value is StoredResult {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredResult>;
  return (
    finiteNonnegative(item.size) &&
    item.size >= 5 &&
    item.size <= 10 &&
    finiteNonnegative(item.seconds) &&
    finiteNonnegative(item.mistakes) &&
    finiteNonnegative(item.undos) &&
    typeof item.usedHint === 'boolean' &&
    finiteNonnegative(item.pace)
  );
}

export function readAdaptiveProfile(): Profile {
  const raw = storageGet(KEY);
  if (!raw) return emptyProfile();
  try {
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const recent = Array.isArray(parsed.recent)
      ? parsed.recent.filter(validResult).slice(-WINDOW)
      : [];
    const direction: Direction =
      parsed.direction === -1 || parsed.direction === 1 ? parsed.direction : 0;
    return {
      offset:
        typeof parsed.offset === 'number' && Number.isFinite(parsed.offset)
          ? clampOffset(parsed.offset)
          : 0,
      direction,
      streak:
        finiteNonnegative(parsed.streak) && parsed.streak <= WINDOW
          ? Math.trunc(parsed.streak)
          : 0,
      recent,
    };
  } catch {
    return emptyProfile();
  }
}

function averagePace(results: StoredResult[]) {
  if (!results.length) return null;
  return results.reduce((sum, item) => sum + item.pace, 0) / results.length;
}

function performanceSignal(
  input: AdaptiveResult,
  history: StoredResult[],
): Direction {
  const pace = input.seconds / Math.max(1, input.size * input.size);
  const baseline = history.length >= 3 ? averagePace(history) : null;
  let struggle = 0,
    mastery = 0;

  if (input.mistakes >= 2) struggle += 2;
  else if (input.mistakes === 0) mastery++;

  if (input.usedHint) struggle++;
  else mastery++;

  if (input.undos >= 3) struggle++;
  else if (input.undos === 0) mastery++;

  if (baseline !== null) {
    if (pace >= baseline * 1.3) struggle++;
    else if (pace <= baseline * 0.85) mastery++;
  }

  if (struggle >= 2) return -1;
  if (mastery >= 3) return 1;
  return 0;
}

export function recordAdaptiveResult(input: AdaptiveResult) {
  if (
    !finiteNonnegative(input.size) ||
    input.size < 5 ||
    input.size > 10 ||
    !finiteNonnegative(input.seconds) ||
    !finiteNonnegative(input.mistakes) ||
    !finiteNonnegative(input.undos) ||
    typeof input.usedHint !== 'boolean'
  )
    return readAdaptiveProfile();

  const profile = readAdaptiveProfile();
  const signal = performanceSignal(input, profile.recent);
  const pace = input.seconds / Math.max(1, input.size * input.size);
  profile.recent = [...profile.recent, { ...input, pace }].slice(-WINDOW);

  if (signal === 0) {
    profile.direction = 0;
    profile.streak = 0;
  } else {
    profile.streak = profile.direction === signal ? profile.streak + 1 : 1;
    profile.direction = signal;
    const threshold = signal < 0 ? 2 : 3;
    if (profile.streak >= threshold) {
      profile.offset = clampOffset(profile.offset + signal);
      profile.direction = 0;
      profile.streak = 0;
    }
  }

  storageSet(KEY, JSON.stringify(profile));
  return profile;
}

export function getAdaptivePhaseOffset() {
  return readAdaptiveProfile().offset;
}
