import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { getScoreBreakdown } from '../src/score';
import {
  getLevel,
  chooseCandidate,
  minimumDifficulty,
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
  const board = Array(size * size).fill(0) as (0 | 1 | 2)[];
  for (let col = 1; col < size; col++) board[col] = 1;
  const hint = getLogicalHint(regions, board);
  expect(hint).not.toMatchObject({
    kind: 'place',
    cell: 0,
    technique: 'single',
  });
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
