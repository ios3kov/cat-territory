import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { applySmartMarks, createInitialBoard } from '../src/game';
import { getLevel } from '../src/infiniteLevels';
import { analyzePuzzle } from '../src/puzzleEngine';
import { levelData } from './helpers/generatedLevel';

async function activateCat(page: Page, index: number, isMobile: boolean) {
  const cell = page.locator(`[data-cell-index="${index}"]`);
  if (isMobile) {
    await cell.scrollIntoViewIfNeeded();
    const bounds = (await cell.boundingBox())!;
    const x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(100);
    await page.touchscreen.tap(x, y);
  } else await cell.click({ button: 'right' });
  await expect(cell.locator('.cat-face')).toHaveCount(1);
  await page.waitForTimeout(450);
}

async function expectEmpty(page: Page) {
  const grid = page.getByRole('grid');
  await expect(grid).toBeVisible();
  await expect(grid.locator('.cat-face,.mark-x')).toHaveCount(0);
  await expect(page.locator('.paw-progress-icon.filled')).toHaveCount(0);
  await expect(grid.locator('[disabled]')).toHaveCount(0);
}

test('the first 24 levels are generated, unique, logically solvable and keep the old size curve', async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Pure generator suite runs once',
  );
  test.setTimeout(180000);
  const expectedSizes = [
    ...Array(4).fill(5),
    ...Array(6).fill(6),
    ...Array(6).fill(7),
    ...Array(8).fill(8),
  ];
  const fingerprints = new Set<string>();
  for (let index = 0; index < 24; index++) {
    const level = getLevel(index);
    expect(level.size, String(index)).toBe(expectedSizes[index]);
    expect(level.id, String(index)).toBe(`generated-v1-${index}-${level.size}`);
    expect(level.starterCats, level.id).toEqual([]);
    expect(createInitialBoard(level), level.id).toEqual(
      Array(level.size * level.size).fill(0),
    );
    const analysis = analyzePuzzle(level.regions);
    expect(analysis.solutionCount, level.id).toBe(1);
    expect(analysis.logicalSolved, level.id).toBe(true);
    expect(analysis.firstSolution, level.id).toEqual(level.solution);
    fingerprints.add(
      createHash('sha256')
        .update(JSON.stringify([level.regions, level.solution]))
        .digest('hex'),
    );
  }
  expect(fingerprints.size).toBe(24);
});

test('later generated levels keep no preset cats', async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Pure generator suite runs once',
  );
  test.setTimeout(180000);
  for (const index of [24, 28, 34, 43]) {
    const level = getLevel(index);
    expect(level.starterCats, String(index)).toEqual([]);
    expect(createInitialBoard(level)).toEqual(
      Array(level.size * level.size).fill(0),
    );
    const analysis = analyzePuzzle(level.regions);
    expect(analysis.solutionCount).toBe(1);
    expect(analysis.logicalSolved).toBe(true);
  }
});

test('legacy generated cache with a retired starter cat is replaced safely', async ({
  page,
}, testInfo) => {
  const template = getLevel(24),
    legacy = {
      ...template,
      starterCats: [template.solution[0]],
    };
  await page.addInitScript((level) => {
    localStorage.setItem('cat-territory-progress-migrated-v3', '1');
    localStorage.setItem('cat-territory-current-level-v3', '24');
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
    localStorage.setItem(
      'cat-territory-generated-v5-24',
      JSON.stringify(level),
    );
  }, legacy);
  await page.goto('/');
  await expect(page.getByRole('gridcell')).toHaveCount(64, { timeout: 60000 });
  await expectEmpty(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('cat-territory-generated-v5-24');
        return raw ? JSON.parse(raw).starterCats : null;
      }),
    )
    .toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('starter-free.png') });
});

test('saved generated games retain moves and Undo; restart is empty', async ({
  page,
  isMobile,
}) => {
  const data = levelData(0),
    [firstCat, secondCat] = data.solutionCells;
  const before = applySmartMarks(
      data.level,
      createInitialBoard(data.level),
      firstCat,
    ),
    board = applySmartMarks(data.level, before, secondCat),
    solution = new Set(data.solutionCells),
    manual = board.findIndex(
      (value, cell) => value === 0 && !solution.has(cell),
    );
  expect(manual).toBeGreaterThanOrEqual(0);
  board[manual] = 1;
  await page.addInitScript(
    ({ saved, level, sessionKey, cacheKey }) => {
      localStorage.setItem('cat-territory-progress-migrated-v3', '1');
      localStorage.setItem('cat-territory-current-level-v3', '0');
      localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
      localStorage.setItem('cat-territory-auto-x-v1', 'off');
      localStorage.setItem(cacheKey, JSON.stringify(level));
      localStorage.setItem(sessionKey, JSON.stringify(saved));
    },
    {
      level: data.level,
      sessionKey: data.sessionKey,
      cacheKey: data.cacheKey,
      saved: {
        board,
        history: [before],
        seconds: 12,
        started: true,
        mistakes: 1,
        usedHint: true,
      },
    },
  );
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.locator('.cat-face')).toHaveCount(2);
  await expect(
    page.locator(`[data-cell-index="${manual}"] .mark-x`),
  ).toHaveCount(1);
  await expect(
    page.getByRole('img', { name: '1 of 3 mistakes' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.cat-face')).toHaveCount(1);
  await activateCat(page, firstCat, isMobile);
  await expect(page.locator('.cat-face')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.locator(`[data-cell-index="${firstCat}"] .cat-face`),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.locator(`[data-cell-index="${firstCat}"] .cat-face`),
  ).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Automatic X marks off' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Restart?', exact: true }).click();
  await expectEmpty(page);
  await page.reload();
  await expectEmpty(page);
});

test('three mistakes restart to an empty generated board', async ({
  page,
  isMobile,
}) => {
  const data = levelData(0);
  await page.addInitScript(
    ({ level, cacheKey }) => {
      localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
      localStorage.setItem(cacheKey, JSON.stringify(level));
    },
    { level: data.level, cacheKey: data.cacheKey },
  );
  await page.goto('/');
  await expectEmpty(page);
  await page.locator(`[data-cell-index="${data.wrongCell}"]`).click();
  for (let attempt = 0; attempt < 3; attempt++) {
    await activateCat(page, data.wrongCell, isMobile);
    await expect(
      page.locator(`[data-cell-index="${data.wrongCell}"]`),
    ).not.toHaveClass(/mistake-cell/);
  }
  await expect(
    page.getByRole('img', { name: '0 of 3 mistakes' }),
  ).toBeVisible();
  await expectEmpty(page);
});
