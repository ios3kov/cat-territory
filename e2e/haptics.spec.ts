import { expect, test } from '@playwright/test';
import { levelData } from './helpers/generatedLevel';

declare global {
  interface Window {
    hapticCalls: (number | number[])[];
  }
}

test.beforeEach(async ({ page }) => {
  const { level, cacheKey } = levelData(0);
  await page.addInitScript(
    ({ level, cacheKey }) => {
      window.hapticCalls = [];
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: (pattern: number | number[]) => {
          window.hapticCalls.push(pattern);
          return true;
        },
      });
      localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
      localStorage.setItem(cacheKey, JSON.stringify(level));
    },
    { level, cacheKey },
  );
  await page.goto('/');
});

test('first board interaction emits haptic feedback when vibration is supported', async ({
  page,
  isMobile,
}) => {
  const cell = page.locator('[data-cell-index="9"]');
  if (isMobile) await cell.tap();
  else await cell.click();
  await expect(cell.locator('.mark-x')).toHaveCount(1);
  expect(await page.evaluate(() => window.hapticCalls.length)).toBeGreaterThan(
    0,
  );
});

test('cat placement, hint and undo keep their haptic wiring', async ({
  page,
  isMobile,
}) => {
  const { solutionCells } = levelData(0);
  const catCell = page.locator(`[data-cell-index="${solutionCells[0]}"]`);
  if (isMobile) {
    const bounds = (await catCell.boundingBox())!;
    const x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(100);
    await page.touchscreen.tap(x, y);
  } else await catCell.click({ button: 'right' });
  await page.waitForTimeout(50);
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await page.getByRole('button', { name: 'Close hint' }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const calls = await page.evaluate(() => window.hapticCalls);
  expect(calls.length).toBeGreaterThanOrEqual(3);
});
