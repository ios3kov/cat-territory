import { expect, test, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('test-auto-x-seeded')) return;
    sessionStorage.setItem('test-auto-x-seeded', '1');
    localStorage.setItem('cat-territory-progress-migrated-v3', '1');
    localStorage.setItem('cat-territory-current-level-v3', '0');
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
    localStorage.setItem('cat-territory-auto-x-v1', 'off');
  });
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.locator('.board .cat-face')).toHaveCount(0);
}

async function placeCat(page: Page, index: number, isMobile: boolean) {
  const cell = page.locator(`[data-cell-index="${index}"]`);
  if (isMobile) {
    await cell.tap();
    await page.waitForTimeout(100);
    await cell.tap({ force: true });
  } else await cell.click({ button: 'right' });
  await expect(cell.locator('.cat-face')).toHaveCount(1);
  await page.waitForTimeout(450);
}

const toggle = (page: Page) =>
  page.getByRole('button', { name: /Automatic X marks/ });
const readBoard = (page: Page) =>
  page.getByRole('gridcell').evaluateAll((cells) =>
    cells.map((cell) =>
      cell.querySelector('.cat-face') ? 2 : cell.querySelector('.mark-x') ? 1 : 0,
    ),
  );
const markedCells = async (page: Page) =>
  (await readBoard(page)).flatMap((value, index) => (value === 1 ? [index] : []));

// Sunbeam, cats at 2 and 5: row, column, territory and touching exclusions.
const TWO_CAT_MARKS = [0, 1, 3, 4, 6, 7, 8, 9, 10, 11, 12, 15, 17, 20, 22];

test('enabling Auto X fills around all existing cats and one Undo restores the board', async ({
  page,
  isMobile,
}) => {
  await start(page);
  await placeCat(page, 2, isMobile);
  await placeCat(page, 5, isMobile);
  for (const index of [7, 24])
    await page.locator(`[data-cell-index="${index}"]`).click();
  const before = await readBoard(page);
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => markedCells(page)).toEqual([...TWO_CAT_MARKS, 24]);
  await expect(page.locator('.board .cat-face')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await readBoard(page)).toEqual(before);
  await page.waitForTimeout(800);
  expect(await readBoard(page)).toEqual(before);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
});
