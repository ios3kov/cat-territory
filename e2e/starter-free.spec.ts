import { expect, test, type Page } from '@playwright/test';
import { buildLevelCatalog } from '../src/levelCatalog';
import { applySmartMarks, createInitialBoard } from '../src/game';
import { getLevel } from '../src/infiniteLevels';
import { analyzePuzzle } from '../src/puzzleEngine';

async function activateCat(page: Page, index: number, isMobile: boolean) {
  const cell = page.locator(`[data-cell-index="${index}"]`);
  if (isMobile) {
    await cell.tap();
    await page.waitForTimeout(100);
    // A real second tap occurs during the bounce, without waiting for stability.
    await cell.tap({ force: true });
  } else await cell.click({ button: 'right' });
  await page.waitForTimeout(450);
}

async function expectEmpty(page: Page) {
  const grid = page.getByRole('grid');
  await expect(grid).toBeVisible();
  await expect(grid.locator('.cat-face,.mark-x')).toHaveCount(0);
  await expect(page.locator('.paw-progress-icon.filled')).toHaveCount(0);
  await expect(grid.locator('[disabled]')).toHaveCount(0);
}

test('curated puzzles stay uniquely solvable without presets', () => {
  const levels = buildLevelCatalog();
  expect(levels).toHaveLength(24);
  for (const level of levels) {
    expect(level.starterCats, level.id).toEqual([]);
    expect(createInitialBoard(level), level.id).toEqual(
      Array(level.size * level.size).fill(0),
    );
    const analysis = analyzePuzzle(level.regions);
    expect(analysis.solutionCount, level.id).toBe(1);
    expect(analysis.logicalSolved, level.id).toBe(true);
  }
  const legacy = { ...levels[0], starterCats: [levels[0].solution[0]] };
  expect(createInitialBoard(legacy)).toEqual(Array(25).fill(0));
});

test('generated transitions have no preset cats', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Pure generator runs once');
  test.setTimeout(180000);
  for (const index of [28, 34, 36, 43]) {
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

test('legacy cache stays empty until a player places a cat', async ({
  page,
  isMobile,
}, testInfo) => {
  const template = buildLevelCatalog()[16];
  const legacy = {
    ...template,
    id: 'endless-v5-24-8',
    source: 'generated' as const,
    starterCats: [template.solution[0]],
  };
  await page.addInitScript((level) => {
    if (sessionStorage.getItem('test-legacy-cache-seeded')) return;
    sessionStorage.setItem('test-legacy-cache-seeded', '1');
    localStorage.setItem('cat-territory-progress-migrated-v3', '1');
    localStorage.setItem('cat-territory-current-level-v3', '24');
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
    localStorage.setItem(
      'cat-territory-generated-v5-24',
      JSON.stringify(level),
    );
  }, legacy);
  await page.goto('/');
  await expect(page.getByRole('gridcell')).toHaveCount(64);
  await expectEmpty(page);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('cat-territory-generated-v5-24')!),
    ),
  ).toEqual({ ...legacy, starterCats: [] });
  await page.screenshot({ path: testInfo.outputPath('starter-free.png') });
  await activateCat(page, template.solution[0], isMobile);
  await expect(page.locator('.cat-face')).toHaveCount(1);
  await expect.poll(() => page.locator('.mark-x').count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectEmpty(page);
  await page.getByRole('button', { name: 'Automatic X marks on' }).click();
  await activateCat(page, template.solution[0], isMobile);
  await expect(page.locator('.cat-face')).toHaveCount(1);
  await expect(page.locator('.mark-x')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.cat-face')).toHaveCount(1);
  await expect(page.locator('.mark-x')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Automatic X marks off' }),
  ).toHaveAttribute('aria-pressed', 'false');
});

test('saved games retain moves and Undo; restart is empty', async ({
  page,
  isMobile,
}) => {
  const level = buildLevelCatalog()[0];
  const before = applySmartMarks(level, createInitialBoard(level), 2);
  const board = applySmartMarks(level, before, 5);
  board[9] = 1;
  await page.addInitScript(
    (saved) => {
      if (sessionStorage.getItem('test-legacy-session-seeded')) return;
      sessionStorage.setItem('test-legacy-session-seeded', '1');
      localStorage.setItem('cat-territory-progress-migrated-v3', '1');
      localStorage.setItem('cat-territory-current-level-v3', '0');
      localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
      localStorage.setItem('cat-territory-auto-x-v1', 'off');
      localStorage.setItem(
        'cat-territory-session-v3-v2-5-01',
        JSON.stringify(saved),
      );
    },
    {
      board,
      history: [before],
      seconds: 12,
      started: true,
      mistakes: 1,
      usedHint: true,
    },
  );
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.locator('.cat-face')).toHaveCount(2);
  await expect(page.locator('[data-cell-index="9"] .mark-x')).toHaveCount(1);
  await expect(
    page.getByRole('img', { name: '1 of 3 mistakes' }),
  ).toBeVisible();
  await expect(page.locator('[data-cell-index="2"]')).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.cat-face')).toHaveCount(1);
  await activateCat(page, 2, isMobile);
  await expect(page.locator('.cat-face')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-cell-index="2"] .cat-face')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-cell-index="2"] .cat-face')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Automatic X marks off' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.getByRole('button', { name: 'Restart?', exact: true }).click();
  await expectEmpty(page);
  await page.reload();
  await expectEmpty(page);
});

test('three mistakes restart to an empty board', async ({ page, isMobile }) => {
  await page.addInitScript(() =>
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done'),
  );
  await page.goto('/');
  await expectEmpty(page);
  await page.locator('[data-cell-index="9"]').click();
  for (let attempt = 0; attempt < 3; attempt++) {
    await activateCat(page, 0, isMobile);
    await expect(page.locator('[data-cell-index="0"]')).not.toHaveClass(
      /mistake-cell/,
    );
  }
  await expect(
    page.getByRole('img', { name: '0 of 3 mistakes' }),
  ).toBeVisible();
  await expectEmpty(page);
});
