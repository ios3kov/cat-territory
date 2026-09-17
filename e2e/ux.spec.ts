import { expect, test } from '@playwright/test';
test('two-step introduction teaches marks and cats then clears itself', async ({
  page,
}, testInfo) => {
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
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip introduction' }).click();
  await page.locator('[data-cell-index="2"]').click({ button: 'right' });
  await expect(page.locator('[data-cell-index="2"] .cat-face')).toHaveCount(1);
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
