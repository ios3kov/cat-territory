import { expect, test } from '@playwright/test';

test('clock survives hidden time and restart confirmation expires', async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() =>
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done'),
  );
  await page.goto('/');
  const root = page.locator('.game-card');
  await root.getByRole('button', { name: 'Hint', exact: true }).click();
  await page.clock.runFor(3200);
  const snapshot = () =>
    page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
      const key = Object.keys(localStorage).find((k) =>
        k.startsWith('cat-territory-session-v3-'),
      );
      return key ? JSON.parse(localStorage.getItem(key)!) : null;
    });
  const first = await snapshot();
  expect(first.started).toBe(true);
  expect(first.usedHint).toBe(true);
  expect(first.seconds).toBeGreaterThanOrEqual(3);
  await page.evaluate(() =>
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    }),
  );
  await page.clock.fastForward(5000);
  await page.evaluate(() =>
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    }),
  );
  await page.clock.runFor(1100);
  expect((await snapshot()).seconds).toBeGreaterThanOrEqual(first.seconds + 5);
  await root.getByRole('button', { name: 'Close hint' }).click();
  await root.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(
    root.getByRole('button', { name: 'Restart?', exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(2300);
  await root.getByRole('button', { name: 'Restart', exact: true }).click();
  await root.getByRole('button', { name: 'Restart?', exact: true }).click();
  await page.clock.fastForward(5000);
  expect(await snapshot()).toBeNull();
});

test('retired mode saves are removed while endless progress and settings survive', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
    localStorage.setItem('cat-territory-daily-progress-v1', '{}');
    localStorage.setItem('cat-territory-daily-level-v2-2026-09-14', '{}');
    localStorage.setItem(
      'cat-territory-session-v3-daily-v2-2026-09-14-7',
      '{}',
    );
    localStorage.setItem(
      'cat-territory-achievements-v2',
      JSON.stringify({
        stats: { completed: 10, flawless: 3, dailyWins: 8, bestDailyStreak: 4 },
        unlocked: ['first', 'ten', 'daily-first'],
      }),
    );
    localStorage.setItem('unrelated-data', 'keep');
  });
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.includes('daily-')),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(() => localStorage.getItem('unrelated-data')),
  ).toBe('keep');
  await expect(page.getByRole('button', { name: /daily/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Progress and achievements' }).click();
  await expect(page.locator('.stats-grid')).toContainText('10');
  await expect(page.locator('.stats-grid')).toContainText('3');
  await page.getByRole('button', { name: 'All achievements' }).click();
  await expect(page.locator('.achievement-row')).toHaveCount(6);
  await expect(page.getByText('Morning Patrol')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem('cat-territory-achievements-v2'),
    ),
  ).not.toMatch(/daily/i);
});
