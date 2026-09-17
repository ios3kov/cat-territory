import { expect, test, type Page } from '@playwright/test';
import { levelData, smartMarkCells } from './helpers/generatedLevel';

const data = levelData(0),
  CATS = data.solutionCells,
  FIRST_TWO = CATS.slice(0, 2),
  TWO_CAT_MARKS = smartMarkCells(0, FIRST_TWO),
  solution = new Set(CATS),
  marked = new Set(TWO_CAT_MARKS),
  MANUAL_CELLS = Array.from(
    { length: data.level.size * data.level.size },
    (_, cell) => cell,
  )
    .filter((cell) => !solution.has(cell) && !marked.has(cell))
    .slice(0, 2),
  EXPECTED_WITH_MANUAL = [...new Set([...TWO_CAT_MARKS, ...MANUAL_CELLS])].sort(
    (a, b) => a - b,
  );

async function start(page: Page) {
  await page.addInitScript(
    ({ level, cacheKey }) => {
      if (sessionStorage.getItem('test-auto-x-seeded')) return;
      sessionStorage.setItem('test-auto-x-seeded', '1');
      localStorage.setItem('cat-territory-progress-migrated-v3', '1');
      localStorage.setItem('cat-territory-current-level-v3', '0');
      localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
      localStorage.setItem('cat-territory-auto-x-v1', 'off');
      localStorage.setItem(cacheKey, JSON.stringify(level));
    },
    { level: data.level, cacheKey: data.cacheKey },
  );
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.locator('.board .cat-face')).toHaveCount(0);
}

async function placeCat(page: Page, index: number, isMobile: boolean) {
  const cell = page.locator(`[data-cell-index="${index}"]`);
  if (isMobile) {
    await cell.scrollIntoViewIfNeeded();
    const bounds = (await cell.boundingBox())!;
    const x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(100);
    await page.touchscreen.tap(x, y);
  } else await cell.click({ button: 'right' });
  await expect(cell.locator('.cat-face')).toHaveCount(1);
  await page.waitForTimeout(450);
}

const toggle = (page: Page) =>
  page.getByRole('button', { name: /Automatic X marks/ });
const readBoard = (page: Page) =>
  page.getByRole('gridcell').evaluateAll((cells) =>
    cells.map((cell) => {
      if (cell.querySelector('.cat-face')) return 2;
      return cell.querySelector('.mark-x') ? 1 : 0;
    }),
  );
const markedCells = async (page: Page) =>
  (await readBoard(page)).flatMap((value, index) =>
    value === 1 ? [index] : [],
  );
const savedSession = (page: Page) =>
  page.evaluate((sessionKey) => {
    window.dispatchEvent(new Event('pagehide'));
    const raw = localStorage.getItem(sessionKey);
    return raw ? JSON.parse(raw) : null;
  }, data.sessionKey);

async function pauseAfterSetup(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 1000));
}

test('enabling Auto X fills around all existing cats and one Undo restores the board', async ({
  page,
  isMobile,
}) => {
  await start(page);
  await placeCat(page, FIRST_TWO[0], isMobile);
  await placeCat(page, FIRST_TWO[1], isMobile);
  for (const index of MANUAL_CELLS)
    await page.locator(`[data-cell-index="${index}"]`).click();
  const before = await readBoard(page);
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => markedCells(page)).toEqual(EXPECTED_WITH_MANUAL);
  await expect(page.locator('.board .cat-face')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await readBoard(page)).toEqual(before);
  await page.waitForTimeout(800);
  expect(await readBoard(page)).toEqual(before);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
});

test('empty and already-filled boards do not gain an Undo step from toggling', async ({
  page,
  isMobile,
}) => {
  await start(page);
  await toggle(page).click();
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  expect(await savedSession(page)).toBeNull();
  await page.locator(`[data-cell-index="${data.wrongCell}"]`).click();
  await toggle(page).click();
  await toggle(page).click();
  expect((await savedSession(page)).history).toHaveLength(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.mark-x')).toHaveCount(0);
  await placeCat(page, CATS[0], isMobile);
  const before = await readBoard(page);
  const historyLength = (await savedSession(page)).history.length;
  await toggle(page).click();
  await toggle(page).click();
  expect((await savedSession(page)).history).toHaveLength(historyLength);
  expect(await readBoard(page)).toEqual(before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.board .cat-face, .mark-x')).toHaveCount(0);
});

test('reload preserves the backfill and its Undo without replay; future cats respect the setting', async ({
  page,
  isMobile,
}) => {
  await start(page);
  await placeCat(page, FIRST_TWO[0], isMobile);
  await placeCat(page, FIRST_TWO[1], isMobile);
  const before = await readBoard(page);
  await savedSession(page);
  await page.reload();
  await expect(page.locator('.board .cat-face')).toHaveCount(2);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await toggle(page).click();
  await expect.poll(() => markedCells(page)).toEqual(TWO_CAT_MARKS);
  await savedSession(page);
  await page.reload();
  await expect.poll(() => markedCells(page)).toEqual(TWO_CAT_MARKS);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await readBoard(page)).toEqual(before);
  await savedSession(page);
  await page.reload();
  await expect(page.locator('.board .cat-face')).toHaveCount(2);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(600);
  expect(await readBoard(page)).toEqual(before);
  await placeCat(page, CATS[2], isMobile);
  const marks = await markedCells(page);
  expect(marks.length).toBeGreaterThan(0);
  await toggle(page).click();
  expect(await markedCells(page)).toEqual(marks);
  await placeCat(page, CATS[3], isMobile);
  expect(await markedCells(page)).toEqual(marks);
});

test('backfill uses the sequential drawing and bounce feedback without moving cats', async ({
  page,
  isMobile,
}, testInfo) => {
  await start(page);
  await placeCat(page, FIRST_TWO[1], isMobile);
  await placeCat(page, FIRST_TWO[0], isMobile);
  const pawOrder = (await savedSession(page)).catOrder;
  const frames = await page.evaluate(async () => {
    const entries: { time: number; bounce: boolean }[] = [];
    const seen = new Set<Element>();
    const observer = new MutationObserver(() => {
      for (const mark of document.querySelectorAll('.board .mark-x')) {
        const cell = mark.closest('[data-cell-index]')!;
        if (seen.has(cell)) continue;
        seen.add(cell);
        entries.push({
          time: performance.now(),
          bounce: Boolean(mark.closest('.feedback-paint')),
        });
      }
    });
    observer.observe(document.querySelector('.board')!, {
      childList: true,
      subtree: true,
    });
    document.querySelector<HTMLButtonElement>('.auto-x-action')!.click();
    await new Promise((resolve) => setTimeout(resolve, 650));
    observer.disconnect();
    return entries;
  });
  expect(frames).toHaveLength(TWO_CAT_MARKS.length);
  expect(frames.at(-1)!.time - frames[0].time).toBeGreaterThan(50);
  expect(frames.every((frame) => frame.bounce)).toBe(true);
  expect((await savedSession(page)).catOrder).toEqual(pawOrder);
  await page.screenshot({ path: testInfo.outputPath('auto-x-backfill.png') });
});

for (const action of ['undo', 'restart', 'off-on'] as const) {
  test(`backfill wave survives ${action} without late marks or duplicate history`, async ({
    page,
    isMobile,
  }) => {
    await page.clock.install();
    await start(page);
    await placeCat(page, FIRST_TWO[0], isMobile);
    await placeCat(page, FIRST_TWO[1], isMobile);
    const before = await readBoard(page);
    const historyLength = (await savedSession(page)).history.length;
    await pauseAfterSetup(page);
    await toggle(page).click({ force: true });
    await page.clock.runFor(90);
    const during = await markedCells(page);
    expect(during.length).toBeGreaterThan(0);
    expect(during.length).toBeLessThan(TWO_CAT_MARKS.length);
    if (action === 'undo') {
      await page
        .getByRole('button', { name: 'Undo', exact: true })
        .click({ force: true });
    } else if (action === 'restart') {
      await page
        .getByRole('button', { name: 'Restart', exact: true })
        .click({ force: true });
      await page
        .getByRole('button', { name: 'Restart?', exact: true })
        .click({ force: true });
    } else {
      await toggle(page).click({ force: true });
      await toggle(page).click({ force: true });
    }
    await page.clock.runFor(1500);
    if (action === 'off-on') {
      await expect.poll(() => markedCells(page)).toEqual(TWO_CAT_MARKS);
      expect((await savedSession(page)).history).toHaveLength(
        historyLength + 1,
      );
      await page
        .getByRole('button', { name: 'Undo', exact: true })
        .click({ force: true });
      await page.clock.runFor(1000);
    }
    if (action === 'restart') {
      expect(await readBoard(page)).toEqual(
        Array(data.level.size * data.level.size).fill(0),
      );
      await expect(
        page.getByRole('button', { name: 'Undo', exact: true }),
      ).toBeDisabled();
    } else {
      expect(await readBoard(page)).toEqual(before);
      expect((await savedSession(page)).history).toHaveLength(historyLength);
    }
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  });
}

test('reduced motion fills immediately and blocked storage does not override the live setting', async ({
  page,
  isMobile,
}) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'cat-territory-auto-x-v1')
        throw new DOMException('Blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await placeCat(page, FIRST_TWO[0], isMobile);
  await placeCat(page, FIRST_TWO[1], isMobile);
  await pauseAfterSetup(page);
  await toggle(page).click({ force: true });
  await expect.poll(() => markedCells(page)).toEqual(TWO_CAT_MARKS);
  await page
    .getByRole('button', { name: 'Undo', exact: true })
    .click({ force: true });
  await expect(page.locator('.mark-x')).toHaveCount(0);
  await page.clock.resume();
  await placeCat(page, CATS[2], isMobile);
  const marks = await markedCells(page);
  expect(marks.length).toBeGreaterThan(0);
  await toggle(page).click();
  await placeCat(page, CATS[3], isMobile);
  expect(await markedCells(page)).toEqual(marks);
});
