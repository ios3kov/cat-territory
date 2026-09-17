import { test, expect, type Page } from '@playwright/test';
async function start(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('cat-territory-progress-migrated-v3', '1');
    localStorage.setItem('cat-territory-current-level-v3', '0');
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
  });
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
}
test('hint on an untouched board is persisted and restartable', async ({
  page,
}) => {
  await start(page);
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const r = localStorage.getItem('cat-territory-session-v3-v2-5-01');
        return r ? JSON.parse(r).usedHint : false;
      }),
    )
    .toBe(true);
  await expect(page.getByRole('region', { name: 'Think here' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('grid')).toBeVisible();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Restart?', exact: true }),
  ).toBeVisible();
});
test('grid exposes rows and assistive activation marks cells', async ({
  page,
}) => {
  await start(page);
  const grid = page.getByRole('grid');
  await expect(grid.getByRole('row')).toHaveCount(5);
  const c = grid.locator('[data-cell-index="0"]');
  await expect(c).toHaveAttribute('aria-label', /empty/);
  await c.evaluate((el: HTMLElement) => el.click());
  await expect(c).toHaveAttribute('aria-label', /marked X/);
});
test('malformed timestamps cannot poison a session', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const m = await import('/src/session.ts');
    localStorage.setItem(
      'cat-territory-session-v3-invalid',
      JSON.stringify({
        board: Array(25).fill(0),
        seconds: 1,
        started: true,
        savedAtMs: 'oops',
      }),
    );
    return m.loadLevelSession('invalid', 5);
  });
  expect(result).toBeNull();
});
test('legacy in-progress boards are reset once when starter cats are retired', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const seedKey = 'cat-territory-test-legacy-session-seeded';
    if (!localStorage.getItem(seedKey)) {
      localStorage.setItem(
        'cat-territory-session-v3-v2-5-01',
        JSON.stringify({
          board: Array.from({ length: 25 }, (_, i) => (i === 2 ? 2 : 0)),
          history: [],
          seconds: 12,
          started: true,
          mistakes: 0,
          usedHint: false,
        }),
      );
      localStorage.setItem(seedKey, '1');
    }
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
  });
  await page.goto('/');
  await expect(page.locator('.cat-face')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem('cat-territory-session-v3-v2-5-01'),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      localStorage.getItem('cat-territory-starter-free-v1'),
    ),
  ).toBe('1');
  await page.locator('[data-cell-index="0"]').click();
  await expect(page.locator('[data-cell-index="0"] .mark-x')).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(localStorage.getItem('cat-territory-session-v3-v2-5-01')),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.locator('[data-cell-index="0"] .mark-x')).toHaveCount(1);
});
test('journal labels describe the statistics actually counted', async ({
  page,
}) => {
  await start(page);
  const labels = await page.evaluate(async () => {
    const m = await import('/src/achievements.ts');
    return m.getTerritoryJournal().map((x: any) => x.label);
  });
  expect(labels).toContain('Flawless');
  expect(labels).toContain('10×10');
});
test('small phone keeps board, title and actions inside the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await start(page);
  for (const x of [
    page.getByRole('heading', { level: 1 }),
    page.getByRole('grid'),
    page.getByRole('button', { name: 'How to play' }),
    page.getByRole('button', { name: 'Hint', exact: true }),
  ]) {
    const b = (await x.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(321);
    expect(b.y + b.height).toBeLessThanOrEqual(569);
  }
  await page.getByRole('button', { name: /Progress and achievements/ }).click();
  await page.getByRole('button', { name: 'All achievements' }).click();
  await expect(
    page.getByRole('heading', { name: 'All achievements' }),
  ).toBeInViewport();
});

test('saved statistics and invalid cats are validated', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const [sessions, game, stats] = await Promise.all([
      import('/src/session.ts'),
      import('/src/game.ts'),
      import('/src/achievements.ts'),
    ]);
    const level = game.getLevel(0),
      invalidBoard = Array(25).fill(0);
    invalidBoard[0] = 2;
    localStorage.setItem(
      'cat-territory-session-v3-' + level.id,
      JSON.stringify({ board: invalidBoard, seconds: 0 }),
    );
    localStorage.setItem(
      'cat-territory-achievements-v2',
      JSON.stringify({
        stats: {
          flawless: 'broken',
          fastest8: { bad: 1 },
          completed: -1,
          bestBySize: { 8: 'oops' },
        },
        unlocked: [null, {}, 'first'],
      }),
    );
    return {
      session: sessions.loadLevelSession(level.id, 5, level),
      stats: stats.getPlayerStats(),
    };
  });
  expect(result.session).toBeNull();
  expect(result.stats.flawless).toBe(0);
  expect(result.stats.fastest8).toBeNull();
  expect(result.stats.completed).toBe(0);
  expect(result.stats.bestBySize).toEqual({});
});

test('core screens pass automated accessibility checks', async ({
  page,
}, testInfo) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  await start(page);
  const check = async (name: string) => {
    if (['rules', 'progress', 'achievements'].includes(name))
      await expect(
        page.locator(name === 'rules' ? '.rules-modal' : '.achievements-modal'),
      ).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      );
    });
    await page.screenshot({
      path: testInfo.outputPath(name + '.png'),
      fullPage: true,
    });
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  };
  await check('board');
  await page.getByRole('button', { name: 'How to play' }).click();
  await check('rules');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Progress and achievements/ }).click();
  await check('progress');
  await page.getByRole('button', { name: 'All achievements' }).click();
  await check('achievements');
  await page.keyboard.press('Escape');
});

test('a failed worker can be retried without reloading the game', async ({
  page,
}) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const resource = await import('/src/levelResource.ts'),
      OriginalWorker = window.Worker,
      level = resource.getLevel(0);
    let calls = 0,
      terminated = 0;
    class StubWorker {
      onmessage: any;
      onerror: any;
      postMessage() {
        calls++;
        queueMicrotask(() =>
          this.onmessage({
            data: calls === 1 ? { error: 'temporary failure' } : { level },
          }),
        );
      }
      terminate() {
        terminated++;
      }
    }
    window.Worker = StubWorker as any;
    try {
      let failed = false;
      try {
        await resource.prepareLevel(24);
      } catch {
        failed = true;
      }
      await resource.prepareLevel(24);
      return { failed, calls, terminated };
    } finally {
      window.Worker = OriginalWorker;
    }
  });
  expect(result).toEqual({ failed: true, calls: 2, terminated: 2 });
});

test('malformed generated metadata is discarded before rendering', async ({
  page,
}) => {
  await start(page);
  const invalid = await page.evaluate(async () => {
    const levels = await import('/src/infiniteLevels.ts');
    localStorage.setItem(
      'cat-territory-generated-v5-24',
      JSON.stringify({ ...levels.getLevel(24), starterCats: null }),
    );
    return levels.readGenerated(24);
  });
  expect(invalid).toBeNull();
});

test('small board remains touchable with an open hint', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await start(page);
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await expect(page.getByLabel('Close hint')).toBeVisible();
  await expect(page.getByRole('grid')).not.toHaveClass(/board-assembling/);
  const clipped = await page.getByRole('gridcell').evaluateAll(
    (cells) =>
      cells.filter((cell) => {
        const r = cell.getBoundingClientRect();
        return (
          document
            .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
            ?.closest('[role="gridcell"]') !== cell
        );
      }).length,
  );
  expect(clipped).toBe(0);
  await expect(page.getByLabel('Close hint')).toBeInViewport();
  await page.getByLabel('Close hint').click();
  for (const name of ['Undo', 'Hint', 'Restart'])
    await expect(
      page.getByRole('button', { name, exact: true }),
    ).toBeInViewport();
  await expect(
    page.getByRole('button', { name: /Automatic X marks/ }),
  ).toBeInViewport();
});
