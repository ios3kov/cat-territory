import { expect, test } from '@playwright/test';
import { levelData } from './helpers/generatedLevel';

const levelOne = levelData(0);

async function seedGeneratedLevel(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ({ level, cacheKey }) =>
      localStorage.setItem(cacheKey, JSON.stringify(level)),
    { level: levelOne.level, cacheKey: levelOne.cacheKey },
  );
}

test('two-step introduction teaches marks and cats then clears itself', async ({
  page,
}, testInfo) => {
  await seedGeneratedLevel(page);
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: '1 of 2 · Mark a tile' }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('introduction.png') });
  await page.locator('.gesture-coach-cell').click();
  await expect(
    page.getByRole('region', { name: '2 of 2 · Find a cat' }),
  ).toBeVisible();
  await page.locator('.gesture-coach-cell').dblclick({ delay: 100 });
  await expect(
    page.getByRole('region', { name: '2 of 2 · Find a cat' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Hint', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('cat-territory-gesture-coach-v3'),
    ),
  ).toBe('done');
  await page.reload();
  await expect(page.locator('.gesture-coach')).toHaveCount(0);
});

test('introduction can be skipped and hints show clue and move without changing board', async ({
  page,
}, testInfo) => {
  await seedGeneratedLevel(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  const firstCat = levelOne.solutionCells[0];
  await page
    .locator(`[data-cell-index="${firstCat}"]`)
    .click({ button: 'right' });
  await expect(
    page.locator(`[data-cell-index="${firstCat}"] .cat-face`),
  ).toHaveCount(1);
  await page.waitForTimeout(450);
  const before = await page
    .locator('[role=gridcell]')
    .evaluateAll((c) => c.map((x) => x.getAttribute('aria-label')));
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await expect(page.locator('.hint-cell').first()).toBeVisible();
  await expect(page.locator('.board')).toHaveClass(/board-attention/);
  await expect(page.locator('.live-cat .cat-idle-body').first()).toHaveCSS(
    'animation-play-state',
    'paused',
  );
  await page.getByRole('button', { name: 'Show move' }).click();
  await expect(page.locator('.hint-target')).toBeVisible();
  await expect(page.locator('.hint-legend')).toContainText('outline');
  await page.screenshot({ path: testInfo.outputPath('hint-explanation.png') });
  await page.getByRole('button', { name: 'Close hint' }).click();
  expect(
    await page
      .locator('[role=gridcell]')
      .evaluateAll((c) => c.map((x) => x.getAttribute('aria-label'))),
  ).toEqual(before);
  await expect(page.locator('.hint-cell')).toHaveCount(0);
  await expect(page.locator('.live-cat .cat-idle-body').first()).toHaveCSS(
    'animation-play-state',
    'running',
  );
});


test('Hint is visually neutral until the idle timer actually expires', async ({
  page,
}) => {
  await page.clock.install();
  await seedGeneratedLevel(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  const hint = page.getByRole('button', { name: 'Hint', exact: true });
  await expect(hint).not.toHaveClass(/hint-attention/);
  await page.locator('[data-cell-index="9"]').click();
  await expect(hint).not.toHaveClass(/hint-attention/);
  await page.clock.fastForward(45001);
  await expect(hint).toHaveClass(/hint-attention/);
  await hint.click();
  await expect(hint).toHaveCount(0);
  await page.clock.fastForward(60000);
  await page.getByRole('button', { name: 'Close hint' }).click();
  const restored = page.getByRole('button', { name: 'Hint', exact: true });
  await expect(restored).not.toHaveClass(/hint-attention/);
});
