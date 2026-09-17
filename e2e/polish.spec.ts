import { test, expect, type Page } from '@playwright/test';
async function start(page: Page, index = 0) {
  await page.addInitScript((i) => {
    localStorage.setItem('cat-territory-progress-migrated-v3', '1');
    localStorage.setItem('cat-territory-current-level-v3', String(i));
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
  }, index);
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 60000 });
}
async function geometry(page: Page) {
  const g = page.getByRole('grid');
  await expect(g).not.toHaveClass(/board-assembling/);
  const b = (await g.boundingBox())!;
  const v = page.viewportSize()!;
  expect(Math.abs(b.width - b.height)).toBeLessThan(1);
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(v.width + 1);
  expect(b.y + b.height).toBeLessThanOrEqual(v.height + 1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const cells = await g.getByRole('gridcell').evaluateAll((xs) =>
    xs.map((x) => {
      const el = x as HTMLElement;
      return [el.offsetWidth, el.offsetHeight];
    }),
  );
  expect(
    Math.max(...cells.map((c) => c[0])) - Math.min(...cells.map((c) => c[0])),
  ).toBeLessThanOrEqual(1);
  const clipped = await g.getByRole('gridcell').evaluateAll((xs) =>
    xs
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return (
          document
            .elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
            ?.closest('[role="gridcell"]') !== el
        );
      })
      .map((el) => el.getAttribute('data-cell-index')),
  );
  expect(clipped).toEqual([]);
}
test('reduced motion skips assembly and wave delays, undo restores everything', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  const before = await page.locator('.mark-x').count();
  await page.locator('[data-cell-index="5"]').focus();
  await page.keyboard.press('c');
  expect(
    await page
      .locator('[data-cell-index="5"]')
      .evaluate((el) => getComputedStyle(el).animationDuration),
  ).toBe('1e-06s');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.mark-x')).toHaveCount(before);
  await expect(page.locator('[data-cell-index="5"] .cat-face')).toHaveCount(0);
});
test('sound setting persists and game emits no runtime errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await page.getByRole('button', { name: 'Sound effects on' }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Sound effects off' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sound effects off' }).click();
  await page.locator('[data-cell-index="5"]').click({ button: 'right' });
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(errors).toEqual([]);
});
test('dialogs trap focus and achievements remain readable', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: /Progress and achievements/ }).click();
  await page.getByRole('button', { name: 'All achievements' }).click();
  await expect(page.locator('.achievement-row')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Close progress' }).focus();
  await page.keyboard.press('Tab');
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: /Progress and achievements/ }),
  ).toBeFocused();
});
test('late board is responsive while the worker generates and has no overflow', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await start(page, 33);
  await geometry(page);
  await expect(page.getByRole('gridcell')).toHaveCount(100);
  const target = await page.evaluate(async () => {
    const { getLevel } = await import('/src/game.ts');
    const level = getLevel(33);
    return level.solution
      .map((col: number, row: number) => row * level.size + col)
      .find((index: number) => !level.starterCats.includes(index))!;
  });
  await page
    .locator(`[data-cell-index="${target}"]`)
    .click({ button: 'right' });
  await expect(page.locator('.live-cat .cat-idle-body').first()).not.toHaveCSS(
    'animation-name',
    'none',
  );
  await page.waitForTimeout(450);
  await page.screenshot({ path: testInfo.outputPath('ten-territories.png') });

  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Give every cat its own territory.' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await geometry(page);
});
test('Auto-X is a sequential wave and one undo survives remaining timers', async ({
  page,
}) => {
  await start(page);
  await page.locator('.board-assembling').waitFor({ state: 'detached' });
  const before = await page.locator('.mark-x').count();
  await page.evaluate(() => {
    (window as any).wave = [];
    const seen = new Set(
      [...document.querySelectorAll('.mark-x')].map((x) => x.parentElement),
    );
    new MutationObserver(() => {
      for (const x of document.querySelectorAll('.mark-x'))
        if (!seen.has(x.parentElement)) {
          seen.add(x.parentElement);
          (window as any).wave.push(performance.now());
        }
    }).observe(document.querySelector('.board')!, {
      subtree: true,
      childList: true,
    });
  });
  await page.locator('[data-cell-index="5"]').focus();
  await page.keyboard.press('c');
  await page.waitForTimeout(500);
  const times = await page.evaluate(() => (window as any).wave as number[]);
  expect(times.length).toBeGreaterThan(2);
  expect(times.at(-1)! - times[0]).toBeGreaterThan(50);
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.waitForTimeout(700);
  await expect(page.locator('.mark-x')).toHaveCount(before);
  await expect(page.locator('[data-cell-index="5"] .cat-face')).toHaveCount(0);
});
test('sound wiring emits one correct cue, throttles marks and resumes after visibility', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const stats = { starts: 0, resumes: 0, suspends: 0 };
    (window as any).audioStats = stats;
    const param = {
      value: 0.18,
      cancelScheduledValues() {},
      setTargetAtTime() {},
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    };
    class FakeAudio {
      state = 'suspended';
      currentTime = 0;
      sampleRate = 44100;
      destination = {};
      createGain() {
        return { gain: param, connect() {}, disconnect() {} };
      }
      createBuffer() {
        return {};
      }
      createBufferSource() {
        return { connect() {}, start() {} };
      }
      createOscillator() {
        return {
          frequency: param,
          connect() {},
          disconnect() {},
          start() {
            stats.starts++;
          },
          stop() {},
        };
      }
      async resume() {
        stats.resumes++;
        this.state = 'running';
      }
      async suspend() {
        stats.suspends++;
        this.state = 'suspended';
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeAudio });
  });
  await start(page);
  await page.locator('[data-cell-index="5"]').focus();
  await page.keyboard.press('c');
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => (window as any).audioStats.starts)).toBe(2);
  const throttled = await page.evaluate(async () => {
    const m = await import('/src/audio.ts');
    const stats = (window as any).audioStats;
    const before = stats.starts;
    m.playSound('mark');
    m.playSound('mark');
    m.playSound('erase');
    return stats.starts - before;
  });
  expect(throttled).toBe(1);
  await page.evaluate(async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => (window as any).audioStats.suspends)).toBe(
    1,
  );
  expect(
    await page.evaluate(() => (window as any).audioStats.resumes),
  ).toBeGreaterThanOrEqual(2);
});
test('cold generation is deterministic and upgrades the persisted cache', async ({
  page,
}) => {
  await start(page, 24);
  const saved = () =>
    page.evaluate(() => localStorage.getItem('cat-territory-generated-v5-24'));
  const first = await saved();
  expect(first).not.toBeNull();
  await page.evaluate(() =>
    localStorage.removeItem('cat-territory-generated-v5-24'),
  );
  await page.reload();
  await expect(page.getByRole('grid')).toBeVisible();
  expect(await saved()).toBe(first);
});
test('double tap cat and all auto marks undo together; wrong cats do not fill paws', async ({
  page,
}) => {
  await start(page);
  await page.locator('.board-assembling').waitFor({ state: 'detached' });
  const before = await page.locator('.mark-x').count();
  await page.locator('[data-cell-index="5"]').dblclick({ delay: 100 });
  await page.waitForTimeout(450);
  await expect(page.locator('[data-cell-index="5"] .cat-face')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.mark-x')).toHaveCount(before);
  await page.locator('[data-cell-index="0"]').click({ button: 'right' });
  await expect(page.locator('.paw-progress-icon.filled')).toHaveCount(0);
});
