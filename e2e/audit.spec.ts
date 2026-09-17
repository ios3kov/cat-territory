import { test, expect, type Page } from '@playwright/test';
import { levelData } from './helpers/generatedLevel';

const levelOne = levelData(0);

async function start(page: Page) {
  await page.addInitScript(
    ({ level, cacheKey }) => {
      localStorage.setItem('cat-territory-progress-migrated-v3', '1');
      localStorage.setItem('cat-territory-current-level-v3', '0');
      localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
      localStorage.setItem(cacheKey, JSON.stringify(level));
    },
    { level: levelOne.level, cacheKey: levelOne.cacheKey },
  );
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
      page.evaluate((sessionKey) => {
        const raw = localStorage.getItem(sessionKey);
        return raw ? JSON.parse(raw).usedHint : false;
      }, levelOne.sessionKey),
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
  await expect(grid.getByRole('row')).toHaveCount(levelOne.level.size);
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
      solution = new Set(
        level.solution.map((col: number, row: number) => row * level.size + col),
      ),
      wrong = Array.from(
        { length: level.size * level.size },
        (_, cell) => cell,
      ).find((cell) => !solution.has(cell))!,
      invalidBoard = Array(level.size * level.size).fill(0);
    invalidBoard[wrong] = 2;
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
      session: sessions.loadLevelSession(level.id, level.size, level),
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
