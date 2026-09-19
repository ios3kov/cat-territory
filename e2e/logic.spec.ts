import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { getScoreBreakdown } from '../src/score';
import {
  ADAPTIVE_DIFFICULTY_KEY,
  getAdaptivePhaseOffset,
  readAdaptiveProfile,
  recordAdaptiveResult,
} from '../src/adaptiveDifficulty';
import {
  getLevel,
  chooseCandidate,
  minimumDifficulty,
  adaptiveProgressionPhase,
  progressionPhase,
  levelSizeAt,
  readGenerated,
  rememberGenerated,
} from '../src/infiniteLevels';
import { analyzePuzzle } from '../src/puzzleEngine';
import { getLogicalHint } from '../src/logicalEngine';

test('canonical score formula covers all bonuses and clamps', () => {
  expect(getScoreBreakdown(8, 77, 0, false)).toEqual({
    board: 4992,
    speed: 1541,
    clean: 950,
    independence: 280,
    total: 7763,
  });
  expect(getScoreBreakdown(8, 77, 0, true)).toEqual({
    board: 4992,
    speed: 1541,
    clean: 500,
    independence: 0,
    total: 7033,
  });
  for (const mistakes of [1, 2, 3])
    expect(getScoreBreakdown(5, 999, mistakes, false)).toEqual({
      board: 1950,
      speed: 0,
      clean: Math.max(0, 360 - mistakes * 120),
      independence: 280,
      total: 2230 + Math.max(0, 360 - mistakes * 120),
    });
});
test('difficulty selection prefers the floor and falls back to the hardest', () => {
  const base = getLevel(0),
    candidates = [100, 280, 500].map((logicalScore) => ({
      ...base,
      logicalScore,
    }));
  expect(chooseCandidate(candidates, 400, false, 5)?.logicalScore).toBe(500);
  expect(chooseCandidate(candidates, 900, true, 9)?.logicalScore).toBe(500);
  expect(chooseCandidate([], 900, true, 9)).toBeNull();
  expect(minimumDifficulty(10, true, 9)).toBe(900);
});
test('late generated puzzles and Moon Runs meet progression floors', async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Pure generator suite runs once',
  );
  test.setTimeout(180000);
  const early = [24, 25, 26].map((i) => getLevel(i).logicalScore);
  for (const i of [33, 40, 43, 49, 53]) {
    const l = getLevel(i),
      analysis = analyzePuzzle(l.regions);
    const legacyHashes: Record<number, string> = {
      33: 'd2fd4a389778073ea396e438a5ec231bff1bacbdcd2d88f9e300fa80cac4862f',
      43: 'c5645cd3b0d2f79411e84fc8e71eb13cc40f1c396c87ba5330ef9b89aa1213d0',
    };
    if (legacyHashes[i])
      expect(
        createHash('sha256').update(JSON.stringify(l.regions)).digest('hex'),
      ).toBe(legacyHashes[i]);
    expect(analysis.solutionCount).toBe(1);
    expect(analysis.logicalSolved).toBe(true);
    expect(analysis.logicalScore).toBe(l.logicalScore);
    expect(l.logicalScore).toBeGreaterThanOrEqual(
      l.special === 'moon-run' ? 900 : 430,
    );
    expect(l.logicalScore).toBeGreaterThan(Math.max(...early));
  }
});

test('hints never promote speculative X marks into a fake single', () => {
  const size = 5;
  const regions = Array.from({ length: size }, () =>
    Array.from({ length: size }, (_, col) => col),
  );
  const empty = Array(size * size).fill(0) as (0 | 1 | 2)[],
    board = [...empty] as (0 | 1 | 2)[];
  for (let col = 1; col < size; col++) board[col] = 1;
  expect(getLogicalHint(regions, board)).toEqual(
    getLogicalHint(regions, empty),
  );
});

test('a contradictory player mark is repaired instead of being used as a premise', () => {
  const level = getLevel(0);
  const board = Array(level.size * level.size).fill(0) as (0 | 1 | 2)[];
  const forcedCat = level.solution[0];
  board[forcedCat] = 1;
  const hint = getLogicalHint(level.regions, board);
  expect(hint?.kind).toBe('repair');
  expect(hint?.highlight).toContain(forcedCat);
});

test('user hint sequence stays valid and progresses representative levels', async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Representative hint solver runs once',
  );
  for (const index of [0, 10, 24, 33]) {
    const level = getLevel(index);
    const board = Array(level.size * level.size).fill(0) as (0 | 1 | 2)[];
    const solution = new Set(
      level.solution.map((col, row) => row * level.size + col),
    );
    for (let step = 0; step < level.size * level.size * 4; step++) {
      if (board.filter((value) => value === 2).length === level.size) break;
      const hint = getLogicalHint(level.regions, board);
      expect(hint, `level ${index + 1}, step ${step + 1}`).not.toBeNull();
      if (!hint) break;
      expect(hint.kind).not.toBe('repair');
      if (hint.kind === 'place') {
        expect(solution.has(hint.cell)).toBe(true);
        board[hint.cell] = 2;
      } else {
        const targets = hint.eliminate ?? [hint.cell];
        for (const cell of targets) {
          expect(solution.has(cell)).toBe(false);
          board[cell] = 1;
        }
      }
    }
    expect(board.filter((value) => value === 2).length).toBe(level.size);
  }
});

test('adaptive difficulty uses hysteresis and never jumps more than one step', () => {
  const memory = new Map<string, string>();
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
    },
  });
  try {
    const strong = {
      size: 7,
      seconds: 70,
      mistakes: 0,
      usedHint: false,
      undos: 0,
    };
    expect(getAdaptivePhaseOffset()).toBe(0);
    recordAdaptiveResult(strong);
    recordAdaptiveResult(strong);
    expect(getAdaptivePhaseOffset()).toBe(0);
    recordAdaptiveResult(strong);
    expect(getAdaptivePhaseOffset()).toBe(1);

    const struggling = {
      size: 7,
      seconds: 240,
      mistakes: 2,
      usedHint: true,
      undos: 3,
    };
    recordAdaptiveResult(struggling);
    expect(getAdaptivePhaseOffset()).toBe(1);
    recordAdaptiveResult(struggling);
    expect(getAdaptivePhaseOffset()).toBe(0);
    recordAdaptiveResult(struggling);
    recordAdaptiveResult(struggling);
    expect(getAdaptivePhaseOffset()).toBe(-1);
    recordAdaptiveResult(struggling);
    recordAdaptiveResult(struggling);
    expect(getAdaptivePhaseOffset()).toBe(-2);
    recordAdaptiveResult(struggling);
    recordAdaptiveResult(struggling);
    expect(getAdaptivePhaseOffset()).toBe(-2);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: previous,
    });
  }
});

test('adaptive difficulty preserves the size curve and clamps phase changes', () => {
  for (let index = 0; index < 60; index++) {
    const size = levelSizeAt(index);
    expect(levelSizeAt(index)).toBe(size);
    expect(adaptiveProgressionPhase(index, -20)).toBe(0);
    expect(adaptiveProgressionPhase(index, 20)).toBe(9);
    const base = progressionPhase(index);
    expect(adaptiveProgressionPhase(index, 1)).toBe(Math.min(9, base + 1));
    expect(adaptiveProgressionPhase(index, -2)).toBe(Math.max(0, base - 2));
  }
});

test('adaptive profile restores safely and ignores corrupted storage', () => {
  const memory = new Map<string, string>();
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
    },
  });
  try {
    memory.set(ADAPTIVE_DIFFICULTY_KEY, '{broken');
    expect(readAdaptiveProfile()).toMatchObject({
      offset: 0,
      direction: 0,
      streak: 0,
      recent: [],
    });

    memory.set(
      ADAPTIVE_DIFFICULTY_KEY,
      JSON.stringify({
        offset: 99,
        direction: 1,
        streak: 999,
        recent: [
          {
            size: 7,
            seconds: 90,
            mistakes: 0,
            usedHint: false,
            undos: 0,
            pace: 1.8,
          },
          { size: 'bad', seconds: -4 },
        ],
      }),
    );
    const profile = readAdaptiveProfile();
    expect(profile.offset).toBe(1);
    expect(profile.streak).toBe(0);
    expect(profile.recent).toHaveLength(1);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: previous,
    });
  }
});

test('adaptive level persistence keeps phase variants isolated', () => {
  const memory = new Map<string, string>();
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
    },
  });
  try {
    const base = getLevel(0);
    rememberGenerated(0, { ...base, name: 'Adaptive low' }, -2);
    rememberGenerated(0, { ...base, name: 'Adaptive high' }, 1);
    expect(readGenerated(0, -2)?.name).toBe('Adaptive low');
    expect(readGenerated(0, 1)?.name).toBe('Adaptive high');
    expect(readGenerated(0, 0)?.name).not.toBe('Adaptive low');
    expect(readGenerated(0, 0)?.name).not.toBe('Adaptive high');
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: previous,
    });
  }
});
