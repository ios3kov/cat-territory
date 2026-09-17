import { expect, test } from '@playwright/test';
import { REGION_COLORS } from '../src/game';

function lab(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const f = (v: number) =>
    v > (6 / 29) ** 3 ? Math.cbrt(v) : v / (3 * (6 / 29) ** 2) + 4 / 29;
  const x = f((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047),
    y = f(r * 0.2126729 + g * 0.7151522 + b * 0.072175),
    z = f((r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
test('palette has stronger chroma and more separation without duplicate colors', () => {
  const old = [
    '#efabb2',
    '#f1cd72',
    '#92cf9f',
    '#8fc3e2',
    '#b99bd8',
    '#e9a3cc',
    '#9bcfcb',
    '#efb78f',
    '#a9b9eb',
    '#c3d789',
  ].map(lab);
  const current = REGION_COLORS.map(lab);
  expect(new Set(REGION_COLORS).size).toBe(10);
  for (let i = 0; i < current.length; i++)
    expect(Math.hypot(current[i][1], current[i][2])).toBeGreaterThan(
      Math.hypot(old[i][1], old[i][2]),
    );
  const minimum = (colors: number[][]) =>
    Math.min(
      ...colors.flatMap((a, i) =>
        colors
          .slice(i + 1)
          .map((b) => Math.hypot(...a.map((v, j) => v - b[j]))),
      ),
    );
  expect(minimum(current)).toBeGreaterThan(minimum(old) * 1.2);
});

test('idle cats have distinct visible motion and pause in hidden tabs', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done'),
  );
  await page.goto('/');
  for (const i of [2, 5, 16]) {
    await page.locator(`[data-cell-index="${i}"]`).click({ button: 'right' });
    await page.waitForTimeout(450);
  }
  const bodies = page.locator('.live-cat .cat-idle-body');
  const motion = await bodies.evaluateAll((elements) =>
    elements.map((el) => {
      const animation = el.getAnimations()[0];
      animation.pause();
      animation.currentTime = 0;
      const initial = getComputedStyle(el).transform;
      animation.currentTime =
        Number(animation.effect!.getTiming().duration) * 0.6;
      return {
        name: getComputedStyle(el).animationName,
        changed: getComputedStyle(el).transform !== initial,
      };
    }),
  );
  expect(new Set(motion.map((m) => m.name)).size).toBe(3);
  expect(motion.every((m) => m.changed)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cats-and-colors.png') });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  for (const body of await bodies.all())
    await expect(body).toHaveCSS('animation-play-state', 'paused');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const body of await bodies.all())
    await expect(body).toHaveCSS('animation-name', 'none');
});

test('winning cat animates in the result and respects reduced motion', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done'),
  );
  await page.goto('/');
  for (const i of [2, 5, 14, 16, 23]) {
    await page.locator(`[data-cell-index="${i}"]`).click({ button: 'right' });
    await page.waitForTimeout(450);
  }
  const body = page.locator('.board .celebrating-cat .cat-idle-body').first();
  await expect(body).toHaveCSS('animation-name', 'cat-victory');
  const changed = await body.evaluate((el) => {
    const a = el.getAnimations()[0];
    a.pause();
    a.currentTime = 0;
    const initial = getComputedStyle(el).transform;
    a.currentTime = 528;
    return getComputedStyle(el).transform !== initial;
  });
  expect(changed).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('winning-cat.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(body).toHaveCSS('animation-name', 'none');
});
