import { slideToNext } from './helpers/slide';
import { levelData } from './helpers/generatedLevel';
import { expect, test } from '@playwright/test';

const levelOne = levelData(0),
  levelOneSolution = levelOne.solutionCells;

async function seedLevel(page: import('@playwright/test').Page, level = 0) {
  await page.addInitScript((index) => {
    localStorage.setItem('cat-territory-progress-migrated-v3', '1');
    localStorage.setItem('cat-territory-current-level-v3', String(index));
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
  }, level);
}

test.describe('CAT TERRITORY production flows', () => {
  test('levels start empty without preset cats or marks', async ({ page }) => {
    await seedLevel(page);
    await page.goto('/');
    await expect(page.locator('.cat-face')).toHaveCount(0);
    await expect(page.locator('.mark-x')).toHaveCount(0);
    await expect(page.locator('.paw-progress-icon.filled')).toHaveCount(0);
    const starterCounts = await page.evaluate(async () => {
      const { getLevel } = await import('/src/game.ts');
      return [0, 4, 10, 16].map((index) => getLevel(index).starterCats.length);
    });
    expect(starterCounts).toEqual([0, 0, 0, 0]);
  });

  test('core controls and wrong-cat feedback', async ({ page }) => {
    await seedLevel(page);
    await page.goto('/');
    await expect(page.getByText(/Level 1 ·/)).toBeVisible();
    await expect(
      page.getByRole('img', { name: '0 of 3 mistakes' }),
    ).toBeVisible();
    const wrong = page.locator(`[data-cell-index="${levelOne.wrongCell}"]`);
    await wrong.click({ button: 'right' });
    await expect(wrong).toHaveClass(/mistake-cell/);
    await expect(page.getByText(/Mistake 1\/3/)).toBeVisible();
    await expect(wrong.locator('.cat-face')).toHaveCount(0, { timeout: 1500 });
  });

  test('smart marks animate, cat feedback stays clean and undo is one action', async ({
    page,
  }) => {
    await seedLevel(page);
    await page.goto('/');
    const before = await page.locator('.mark-x').count(),
      catIndex = levelOneSolution.find((index) => index >= levelOne.level.size)!,
      previousIndex = catIndex - levelOne.level.size,
      first = page.locator(`[data-cell-index="${previousIndex}"]`),
      cat = page.locator(`[data-cell-index="${catIndex}"]`);
    await first.focus();
    await page.keyboard.press('ArrowDown');
    await expect(cat).toBeFocused();
    await page.keyboard.press('c');
    await expect(cat.locator('.cat-face')).toHaveCount(1);
    await expect(cat.locator('.score-pop,.correct-spark')).toHaveCount(0);
    await expect
      .poll(() => page.locator('.mark-x-drawn').count())
      .toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(cat.locator('.cat-face')).toHaveCount(0);
    await expect(page.locator('.mark-x')).toHaveCount(before);
  });

  test('Auto X toggle disables future smart marks and persists', async ({
    page,
  }) => {
    await seedLevel(page);
    await page.goto('/');
    await expect(page.locator('.action-row > button')).toHaveCount(4);
    const autoXOn = page.getByRole('button', { name: 'Automatic X marks on' });
    await expect(autoXOn).toHaveAttribute('aria-pressed', 'true');
    const before = await page.locator('.mark-x').count();
    await autoXOn.click();
    const autoXOff = page.getByRole('button', {
      name: 'Automatic X marks off',
    });
    await expect(autoXOff).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    const persistedOff = page.getByRole('button', {
      name: 'Automatic X marks off',
    });
    await expect(persistedOff).toHaveAttribute('aria-pressed', 'false');
    const firstCatIndex = levelOneSolution[0],
      secondCatIndex = levelOneSolution[1],
      cat = page.locator(`[data-cell-index="${firstCatIndex}"]`);
    await cat.click({ button: 'right' });
    await expect(cat.locator('.cat-face')).toHaveCount(1);
    await page.waitForTimeout(450);
    await expect(page.locator('.mark-x')).toHaveCount(before);
    await persistedOff.click();
    await expect(
      page.getByRole('button', { name: 'Automatic X marks on' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator('.mark-x').count()).toBeGreaterThan(before);
    const afterBackfill = await page.locator('.mark-x').count(),
      secondCat = page.locator(`[data-cell-index="${secondCatIndex}"]`);
    await secondCat.click({ button: 'right' });
    await expect(secondCat.locator('.cat-face')).toHaveCount(1);
    await expect
      .poll(() => page.locator('.mark-x').count())
      .toBeGreaterThanOrEqual(afterBackfill);
  });

  test('paws fill left to right in discovery colors and restore through Undo and reload', async ({
    page,
  }) => {
    await seedLevel(page);
    await page.goto('/');
    const paws = page.locator('.paw-progress-icon');
    const read = () =>
      paws.evaluateAll((xs) =>
        xs.map((x) =>
          x.classList.contains('filled') ? getComputedStyle(x).color : null,
        ),
      );
    const color = (index: number) =>
      page
        .locator(`[data-cell-index="${index}"]`)
        .evaluate((x) => getComputedStyle(x).backgroundColor);
    const expected: string[] = [];
    await expect.poll(read).toEqual(Array(levelOne.level.size).fill(null));
    const discovery = [
      levelOneSolution[0],
      levelOneSolution.at(-1)!,
      levelOneSolution[1],
    ];
    for (const index of discovery) {
      await page
        .locator(`[data-cell-index="${index}"]`)
        .click({ button: 'right' });
      expected.push(await color(index));
      await expect
        .poll(read)
        .toEqual([
          ...expected,
          ...Array(levelOne.level.size - expected.length).fill(null),
        ]);
      await page.waitForTimeout(450);
    }
    await page.reload();
    await expect
      .poll(read)
      .toEqual([
        ...expected,
        ...Array(levelOne.level.size - expected.length).fill(null),
      ]);
    await page
      .locator(`[data-cell-index="${discovery[1]}"]`)
      .click({ button: 'right' });
    await expect
      .poll(read)
      .toEqual([
        expected[0],
        expected[2],
        ...Array(levelOne.level.size - 2).fill(null),
      ]);
    await page.reload();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect
      .poll(read)
      .toEqual([
        ...expected,
        ...Array(levelOne.level.size - expected.length).fill(null),
      ]);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect
      .poll(read)
      .toEqual([
        expected[0],
        expected[1],
        ...Array(levelOne.level.size - 2).fill(null),
      ]);
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await page.getByRole('button', { name: 'Restart?', exact: true }).click();
    await expect.poll(read).toEqual(Array(levelOne.level.size).fill(null));
  });

  test('win keeps the board visible with one slide and an inline score', async ({
    page,
  }) => {
    await seedLevel(page);
    await page.goto('/');
    for (const index of levelOneSolution) {
      const cell = page.locator(`[data-cell-index="${index}"]`);
      await cell.click({ button: 'right' });
      await expect(cell.locator('.cat-face')).toHaveCount(1);
      await page.waitForTimeout(450);
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('grid')).toBeVisible();
    const result = page.locator('.completion-summary');
    await expect(result).toContainText('Perfect.');
    await expect(result).toBeInViewport();
    await expect(result).toHaveAttribute(
      'aria-label',
      /Score .*Board .*speed .*clean play .*no hint/,
    );
    await expect(
      page.getByRole('slider', { name: 'Slide to next level' }),
    ).toHaveCount(1);
    await slideToNext(page);
    await expect(page.getByText(/Level 2 ·/)).toBeVisible();
  });

  test('territories map one-to-one to deterministic colors', async ({
    page,
  }) => {
    await seedLevel(page);
    await page.goto('/');
    const cells = page.locator('[data-cell-index]');
    const read = () =>
      cells.evaluateAll((items) =>
        items.map((el) => ({
          region: el.getAttribute('data-region'),
          color: getComputedStyle(el).backgroundColor,
        })),
      );
    const before = await read();
    const byRegion = new Map<string, string>();
    for (const cell of before) {
      expect(cell.region).not.toBeNull();
      const existing = byRegion.get(cell.region!);
      if (existing) expect(cell.color).toBe(existing);
      else byRegion.set(cell.region!, cell.color);
    }
    expect(byRegion.size).toBe(levelOne.level.size);
    expect(new Set(byRegion.values()).size).toBe(byRegion.size);
    await page.reload();
    expect(await read()).toEqual(before);
  });

  test('board exposes grid semantics keyboard navigation and stays in viewport', async ({
    page,
  }) => {
    await seedLevel(page);
    await page.goto('/');
    const grid = page.getByRole('grid');
    await expect(grid).toHaveAttribute('aria-rowcount', '5');
    await expect(grid).toHaveAttribute('aria-colcount', '5');
    const cells = page.getByRole('gridcell');
    await expect(cells).toHaveCount(25);
    const first = page.locator('[data-cell-index="0"]');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-cell-index="1"]')).toBeFocused();
    const box = await grid.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      (await page.evaluate(() => innerWidth)) + 1,
    );
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      (await page.evaluate(() => innerHeight)) + 1,
    );
  });

  test('rules and progress restore focus', async ({ page }) => {
    await seedLevel(page);
    await page.goto('/');
    const help = page.getByRole('button', { name: 'How to play' });
    await help.focus();
    await help.click();
    const rules = page.getByRole('dialog', {
      name: 'Give every cat its own territory.',
    });
    await expect(rules).toBeVisible();
    await rules.getByRole('button', { name: 'More rules' }).click();
    await expect(rules.getByText(/Smart marks:/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toBeFocused();
    const progress = page.getByRole('button', {
      name: /Progress and achievements/i,
    });
    await progress.click();
    await expect(page.getByLabel('Territory Journal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(progress).toBeFocused();
  });
});
