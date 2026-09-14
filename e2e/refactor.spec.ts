import { expect, test } from '@playwright/test';

for (const mode of ['endless', 'daily'] as const) {
  test(`${mode} clock survives hidden time and restart confirmation expires`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.addInitScript(() =>
      localStorage.setItem('cat-territory-gesture-coach-v3', 'done'),
    );
    await page.goto('/');
    if (mode === 'daily')
      await page.getByRole('button', { name: 'Open Daily Territory' }).click();
    const root = page.locator(
      mode === 'daily' ? '.daily-screen' : '.game-card',
    );
    await root.getByRole('button', { name: 'Hint', exact: true }).click();
    await page.clock.runFor(3200);
    const snapshot = () =>
      page.evaluate((daily) => {
        window.dispatchEvent(new Event('pagehide'));
        const key = Object.keys(localStorage).find(
          (k) =>
            k.startsWith('cat-territory-session-v3-') &&
            k.includes('daily-') === daily,
        );
        return key ? JSON.parse(localStorage.getItem(key)!) : null;
      }, mode === 'daily');
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
    expect((await snapshot()).seconds).toBeGreaterThanOrEqual(
      first.seconds + 5,
    );
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
}
