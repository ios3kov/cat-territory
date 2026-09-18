import { test, expect, type Page } from '@playwright/test';
import { getLevel } from '../src/infiniteLevels';
import { slideToNext } from './helpers/slide';

const slider = (page: Page) => page.locator('.slide-handle');
const track = (page: Page) => page.getByTestId('next-level-slide');

async function start(
  page: Page,
  index = 0,
  almostWon = false,
  seedNextLevel = false,
) {
  const level = getLevel(index),
    nextLevel = seedNextLevel ? getLevel(index + 1) : null;
  const cats = level.solution.map((col, row) => row * level.size + col);
  const board = Array(level.size * level.size).fill(0);
  if (almostWon) for (const cell of cats.slice(0, -1)) board[cell] = 2;
  await page.addInitScript(
    ({ index, level, nextLevel, board, almostWon }) => {
      if (sessionStorage.getItem('slide-test-seeded')) return;
      sessionStorage.setItem('slide-test-seeded', '1');
      localStorage.setItem('cat-territory-progress-migrated-v3', '1');
      localStorage.setItem('cat-territory-current-level-v3', String(index));
      localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
      localStorage.setItem(
        'cat-territory-generated-v5-' + index,
        JSON.stringify(level),
      );
      if (nextLevel)
        localStorage.setItem(
          'cat-territory-generated-v5-' + (index + 1),
          JSON.stringify(nextLevel),
        );
      if (almostWon)
        localStorage.setItem(
          'cat-territory-session-v3-' + level.id,
          JSON.stringify({
            board,
            seconds: 40,
            history: [],
            mistakes: 0,
            usedHint: false,
          }),
        );
    },
    { index, level, nextLevel, board, almostWon },
  );
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByRole('grid')).not.toHaveClass(/board-assembling/);
  return cats;
}

async function placeCat(page: Page, index: number, touch: boolean) {
  const cell = page.locator(`[data-cell-index="${index}"]`);
  if (touch) {
    await cell.scrollIntoViewIfNeeded();
    const bounds = (await cell.boundingBox())!;
    const x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(100);
    await page.touchscreen.tap(x, y);
  } else await cell.click({ button: 'right' });
  await expect(cell.locator('.cat-face')).toHaveCount(1);
  await page.waitForTimeout(420);
}

async function win(
  page: Page,
  touch: boolean,
  index = 0,
  seedNextLevel = false,
) {
  const cells = await start(page, index, true, seedNextLevel);
  await placeCat(page, cells.at(-1)!, touch);
  await expect(slider(page)).toHaveAttribute('data-disabled', 'false');
}

test('victory stays on the board and four actions morph without changing the dock bounds', async ({
  page,
  isMobile,
}, testInfo) => {
  const cats = await start(page);
  const before = (await page.locator('.action-row').boundingBox())!;
  for (const cat of cats) await placeCat(page, cat, isMobile);
  await expect(slider(page)).toHaveAttribute('data-disabled', 'false');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.locator('.board .cat-face')).toHaveCount(5);
  await expect(page.locator('.completion-summary')).toContainText('pts');
  await expect(
    page.getByRole('button', { name: 'Next level', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Hint', exact: true }),
  ).toHaveCount(0);
  const after = (await track(page).boundingBox())!;
  for (const dimension of ['x', 'y', 'width', 'height'] as const)
    expect(after[dimension]).toBeCloseTo(before[dimension], 0);
  await page.screenshot({
    path: testInfo.outputPath('victory-slide.png'),
    fullPage: true,
  });
  await slideToNext(page);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 2,/,
  );
  await expect(page.getByRole('grid')).not.toHaveClass(/board-assembling/);
  await expect(slider(page)).toHaveCount(0);
  await expect(page.locator('.action-row button')).toHaveCount(4);
  await expect(
    page.getByRole('button', { name: 'Hint', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.board .cat-face, .board .mark-x')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 2,/,
  );
});

test('keyboard and assistive users can continue without changing the drag contract', async ({
  page,
  isMobile,
}) => {
  await win(page, isMobile);
  const fallback = page.getByRole('button', { name: 'Continue to next level' });
  await expect(fallback).toHaveCount(1);
  await fallback.focus();
  await expect(fallback).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 2,/,
  );
});

test('slider keeps both boards aligned with an 8% scrub gap and no post-slide redraw', async ({
  page,
  isMobile,
}) => {
  await win(page, isMobile, 0, true);
  const oldLayer = page.locator('.board-transition-old-layer');
  const newLayer = page.locator('.board-transition-new-layer');
  const oldCells = oldLayer.locator('.cell');
  const newCells = newLayer.locator('.cell');
  await expect(newCells.first()).toHaveCount(1);

  const oldBoard = (await oldLayer.locator('.board-wrap').boundingBox())!;
  const newBoard = (await newLayer.locator('.board-wrap').boundingBox())!;
  for (const dimension of ['x', 'y', 'width', 'height'] as const)
    expect(newBoard[dimension]).toBeCloseTo(oldBoard[dimension], 0);

  const trackBounds = (await track(page).boundingBox())!;
  const thumbBounds = (await slider(page).boundingBox())!;
  const startX = thumbBounds.x + thumbBounds.width / 2;
  const y = thumbBounds.y + thumbBounds.height / 2;
  const travel = trackBounds.width - thumbBounds.width;

  const moveTo = async (fraction: number) => {
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + travel * fraction, y, { steps: 16 });
  };
  const reset = async () => {
    await page.mouse.move(startX, y, { steps: 10 });
    await page.mouse.up();
    await expect(slider(page)).toHaveAttribute('data-progress', '0');
    await page.waitForTimeout(350);
  };
  const opacity = async (locator: ReturnType<typeof oldCells.nth>) =>
    Number(
      await locator.evaluate((element) => getComputedStyle(element).opacity),
    );

  await moveTo(0.08);
  expect(await opacity(newCells.first())).toBeLessThan(0.05);
  await reset();

  await moveTo(0.2);
  expect(await opacity(oldCells.first())).toBeLessThan(0.05);
  expect(await opacity(oldCells.last())).toBeGreaterThan(0.95);
  expect(await opacity(newCells.first())).toBeGreaterThan(0.05);
  await reset();

  await moveTo(0.5);
  const oldOpacity = await oldCells.evaluateAll((cells) =>
    cells.map((cell) => Number(getComputedStyle(cell).opacity)),
  );
  const newOpacity = await newCells.evaluateAll((cells) =>
    cells.map((cell) => Number(getComputedStyle(cell).opacity)),
  );
  const size = Math.sqrt(oldOpacity.length);
  for (let row = 0; row < size; row++)
    for (let column = 0; column < size; column++) {
      const index = row * size + column;
      expect(oldOpacity[index] > 0.05 && newOpacity[index] > 0.05).toBe(false);
    }
  const transitionIndex = async (index: number) =>
    Number(
      await oldCells
        .nth(index)
        .evaluate((element) =>
          getComputedStyle(element).getPropertyValue('--transition-cell'),
        ),
    );
  expect(await transitionIndex(0)).toBeLessThan(
    await transitionIndex(size - 1),
  );
  expect(await transitionIndex(0)).toBeLessThan(await transitionIndex(size));
  expect(await transitionIndex(1)).toBeCloseTo(await transitionIndex(size), 5);
  expect(await opacity(oldCells.first())).toBeLessThan(
    await opacity(oldCells.last()),
  );
  await reset();

  await moveTo(0.8);
  expect(await opacity(oldCells.last())).toBeLessThan(0.05);
  expect(await opacity(newCells.first())).toBeGreaterThan(0.95);
  expect(await opacity(newCells.last())).toBeLessThan(0.95);
  await reset();

  await moveTo(1);
  expect(await opacity(oldCells.last())).toBeLessThan(0.05);
  expect(await opacity(newCells.last())).toBeGreaterThan(0.95);
  await reset();
});

test('releasing below the threshold animates the slider and board back to zero', async ({
  page,
  isMobile,
}) => {
  await win(page, isMobile, 0, true);
  const oldCells = page.locator('.board-transition-old-layer .cell');
  const bounds = (await track(page).boundingBox())!;
  const thumb = (await slider(page).boundingBox())!;
  const x = thumb.x + thumb.width / 2,
    y = thumb.y + thumb.height / 2,
    travel = bounds.width - thumb.width;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + travel * 0.6, y, { steps: 12 });
  const draggedVisible = (
    await oldCells.evaluateAll((cells) =>
      cells.map((el) => Number(getComputedStyle(el).opacity)),
    )
  ).reduce((sum, opacity) => sum + opacity, 0);
  await page.mouse.up();
  await expect(track(page)).toHaveAttribute('data-state', 'returning');
  await page.waitForTimeout(70);
  const midProgress = Number(await slider(page).getAttribute('data-progress'));
  expect(midProgress).toBeGreaterThan(0);
  expect(midProgress).toBeLessThan(60);
  const midVisible = (
    await oldCells.evaluateAll((cells) =>
      cells.map((el) => Number(getComputedStyle(el).opacity)),
    )
  ).reduce((sum, opacity) => sum + opacity, 0);
  expect(midVisible).toBeGreaterThan(draggedVisible);
  await expect(slider(page)).toHaveAttribute('data-progress', '0');
  await expect(track(page)).toHaveAttribute('data-state', 'idle');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 1,/,
  );
});

test('completed drag holds at the endpoint before the dock morphs back', async ({
  page,
  isMobile,
}) => {
  await win(page, isMobile, 0, true);
  const bounds = (await track(page).boundingBox())!;
  const thumb = (await slider(page).boundingBox())!;
  const x = thumb.x + thumb.width / 2,
    y = thumb.y + thumb.height / 2,
    travel = bounds.width - thumb.width;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + travel * 0.9, y, { steps: 12 });
  await expect(slider(page)).toHaveAttribute('data-progress', '90');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 1,/,
  );

  await page.evaluate(() => {
    const slide = document.querySelector<HTMLElement>(
      '[data-testid="next-level-slide"]',
    )!;
    const board = document.querySelector<HTMLElement>('.board-stage')!;
    const timeline: Array<{
      state: string | null;
      time: number;
      progress: number;
    }> = [];
    const samples: Array<{
      state: string | null;
      slider: number;
      board: number;
    }> = [];
    const snapshot = () => ({
      state: slide.dataset.state ?? null,
      time: performance.now(),
      progress: Number(
        getComputedStyle(slide).getPropertyValue('--slide-progress'),
      ),
    });
    timeline.push(snapshot());
    const observer = new MutationObserver(() => timeline.push(snapshot()));
    observer.observe(slide, {
      attributes: true,
      attributeFilter: ['data-state'],
    });
    const sample = () => {
      if (!slide.isConnected) return;
      samples.push({
        state: slide.dataset.state ?? null,
        slider: Number(
          getComputedStyle(slide).getPropertyValue('--slide-progress'),
        ),
        board: Number(
          getComputedStyle(board).getPropertyValue(
            '--level-transition-progress',
          ),
        ),
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    (window as any).__slideTimeline = timeline;
    (window as any).__slideSamples = samples;
    (window as any).__slideObserver = observer;
  });

  await page.mouse.up();
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 2,/,
  );
  await expect(track(page)).toHaveCount(0);
  await expect(page.locator('.action-dock')).not.toHaveClass(/is-handoff/);
  await expect(page.locator('.action-row')).toBeVisible();

  const recorded = await page.evaluate(() => {
    (window as any).__slideObserver?.disconnect();
    return {
      timeline: (window as any).__slideTimeline as Array<{
        state: string | null;
        time: number;
        progress: number;
      }>,
      samples: (window as any).__slideSamples as Array<{
        state: string | null;
        slider: number;
        board: number;
      }>,
    };
  });
  const confirmed = recorded.timeline.find(
    (item) => item.state === 'confirmed',
  );
  const loading = recorded.timeline.find((item) => item.state === 'loading');
  expect(recorded.timeline.some((item) => item.state === 'settling')).toBe(
    true,
  );
  expect(confirmed?.progress).toBe(1);
  expect(loading).toBeTruthy();
  expect(loading!.time - confirmed!.time).toBeGreaterThanOrEqual(120);
  expect(recorded.timeline.some((item) => item.state === 'handoff')).toBe(true);

  const settlingSamples = recorded.samples.filter(
    (sample) => sample.state === 'settling',
  );
  expect(settlingSamples.length).toBeGreaterThan(0);
  for (const sample of settlingSamples)
    expect(Math.abs(sample.slider - sample.board)).toBeLessThan(0.000001);
});

test('tap, edge clicks, short drags, backtracking and extra keys cannot advance', async ({
  page,
  isMobile,
}) => {
  await win(page, isMobile);
  await slider(page).click();
  const bounds = (await track(page).boundingBox())!;
  await page.mouse.click(
    bounds.x + bounds.width - 12,
    bounds.y + bounds.height / 2,
  );
  for (const key of ['Enter', 'Space', 'ArrowRight', 'End']) {
    await slider(page).focus();
    await page.keyboard.press(key);
  }
  await slideToNext(page, 0.79);
  await expect(slider(page)).toHaveAttribute('data-progress', '0');
  await page.waitForTimeout(350);
  await slideToNext(page, 0.9, false);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 1,/,
  );
  await page.mouse.move(
    bounds.x + 28 + (bounds.width - 56) * 0.4,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.up();
  await expect(slider(page)).toHaveAttribute('data-progress', '0');
  await page.waitForTimeout(350);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 1,/,
  );
  await slideToNext(page, 0.81);
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 2,/,
  );
});

for (const interrupt of ['cancel', 'lost-capture', 'blur', 'resize'] as const) {
  test(`an interrupted drag (${interrupt}) resets and the next drag still works`, async ({
    page,
    isMobile,
  }) => {
    await win(page, isMobile);
    await slider(page).evaluate((el) => {
      el.addEventListener(
        'pointerdown',
        (event) => {
          (el as HTMLElement).dataset.testPointerId = String(
            (event as PointerEvent).pointerId,
          );
        },
        { once: true },
      );
    });
    await slideToNext(page, 0.5, false);
    await expect(track(page)).toHaveAttribute('data-state', 'dragging');
    if (interrupt === 'resize') {
      const size = page.viewportSize()!;
      await page.setViewportSize({
        width: size.width + 15,
        height: size.height,
      });
    } else if (interrupt === 'blur')
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else
      await slider(page).evaluate(
        (el, type) =>
          el.dispatchEvent(
            new PointerEvent(type, {
              pointerId: Number((el as HTMLElement).dataset.testPointerId),
              bubbles: true,
            }),
          ),
        interrupt === 'cancel' ? 'pointercancel' : 'lostpointercapture',
      );
    if (interrupt === 'resize')
      await expect(track(page)).toHaveAttribute('data-state', 'idle');
    else {
      await expect(track(page)).toHaveAttribute('data-state', 'returning');
      await expect(track(page)).toHaveAttribute('data-state', 'idle');
    }
    await page.mouse.up();
    await expect(slider(page)).toHaveAttribute('data-progress', '0');
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-label',
      /Puzzle level 1,/,
    );
    await slideToNext(page);
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-label',
      /Puzzle level 2,/,
    );
  });
}

test('a native touch drag follows the finger and releases to the next level', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || !isMobile,
    'Native touch movement uses Chromium CDP; WebKit runs the pointer contract',
  );
  await win(page, true);
  const thumb = (await slider(page).boundingBox())!,
    bounds = (await track(page).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = thumb.x + thumb.width / 2,
    y = thumb.y + thumb.height / 2;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  for (let i = 1; i <= 10; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: x + (bounds.width - thumb.width) * i * 0.09, y: y + 14, id: 1 },
      ],
    });
  await expect(track(page)).toHaveAttribute('data-state', 'dragging');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 1,/,
  );
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 2,/,
  );
  await cdp.detach();
});

test('slow generation keeps the solved board; failure retries in the slider without duplicate requests', async ({
  page,
  isMobile,
}) => {
  const template = getLevel(24);
  await page.addInitScript(() => {
    (window as any).__workerCalls = 0;
    class TestWorker {
      onmessage: any;
      onerror: any;
      postMessage() {
        (window as any).__workerCalls++;
        (window as any).__worker = this;
      }
      terminate() {}
    }
    window.Worker = TestWorker as any;
  });
  await win(page, isMobile, 23);
  await slideToNext(page);
  await expect(track(page)).toHaveAttribute('data-state', 'loading');
  await expect(track(page)).toContainText('Preparing');
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 24,/,
  );
  await expect(page.locator('.board-stage')).not.toHaveClass(/level-leaving/);
  await expect(page.locator('.board .cat-face')).toHaveCount(8);
  await slider(page).dispatchEvent('pointerup', {
    pointerId: 1,
    clientX: 10000,
    clientY: 0,
  });
  expect(await page.evaluate(() => (window as any).__workerCalls)).toBe(1);
  await page.evaluate(() =>
    (window as any).__worker.onmessage({
      data: { error: 'temporary test failure' },
    }),
  );
  await expect(track(page)).toHaveAttribute('data-state', 'error');
  await expect(track(page)).toContainText('Slide to retry');
  await expect(slider(page)).toHaveAttribute('data-disabled', 'false');
  await page.waitForTimeout(350);
  await slideToNext(page);
  await expect(track(page)).toHaveAttribute('data-state', 'loading');
  expect(await page.evaluate(() => (window as any).__workerCalls)).toBe(2);
  await page.evaluate(
    (level) => (window as any).__worker.onmessage({ data: { level } }),
    template,
  );
  await expect(page.getByRole('grid')).toHaveAttribute(
    'aria-label',
    /Puzzle level 25,/,
  );
  await expect(page.locator('.board .cat-face, .board .mark-x')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Hint', exact: true }),
  ).toBeVisible();
});

test('small 10x10 victory fits and reduced motion removes transition delays', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await win(page, isMobile, 34);
  await expect(page.getByRole('gridcell')).toHaveCount(100);
  for (const item of [
    track(page),
    slider(page),
    page.getByRole('grid'),
    page.locator('.completion-summary'),
  ]) {
    const b = (await item.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(321);
    expect(b.y + b.height).toBeLessThanOrEqual(569);
  }
  const b = (await slider(page).boundingBox())!;
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.height).toBeGreaterThanOrEqual(44);
  await expect(slider(page)).toHaveCSS('transition-duration', '0s');
  await expect(
    page.locator('.board .celebrating-cat .cat-idle-body').first(),
  ).toHaveCSS('animation-name', 'none');
  await page.screenshot({
    path: testInfo.outputPath('small-10x10-slide.png'),
    fullPage: true,
  });
});
