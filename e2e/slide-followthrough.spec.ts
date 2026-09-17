import { expect, test } from '@playwright/test';
import { levelData } from './helpers/generatedLevel';
import { slideToNext } from './helpers/slide';

const first = levelData(0),
  second = levelData(1);

for (const mistakes of [0, 1]) {
  test(`small-phone result keeps the score readable and consecutive wins re-arm (${mistakes} mistakes)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const board = Array(first.level.size * first.level.size).fill(0);
    for (const cell of first.solutionCells.slice(0, -1)) board[cell] = 2;
    await page.addInitScript(
      ({ board, mistakes, sessionKey }) => {
        if (sessionStorage.getItem('slide-followthrough-seeded')) return;
        sessionStorage.setItem('slide-followthrough-seeded', '1');
        localStorage.setItem('cat-territory-progress-migrated-v3', '1');
        localStorage.setItem('cat-territory-current-level-v3', '0');
        localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
        localStorage.setItem(
          sessionKey,
          JSON.stringify({ board, seconds: 40, mistakes, usedHint: true }),
        );
      },
      { board, mistakes, sessionKey: first.sessionKey },
    );
    await page.goto('/');
    await expect(page.getByRole('grid')).not.toHaveClass(/board-assembling/);
    await page
      .locator(`[data-cell-index="${first.solutionCells.at(-1)!}"]`)
      .click({ button: 'right' });
    const slider = page.getByRole('slider', { name: 'Slide to next level' });
    await expect(slider).toHaveAttribute('aria-disabled', 'false');
    const summary = page.locator('.completion-summary');
    await expect(summary).toHaveAttribute(
      'aria-label',
      new RegExp(mistakes ? 'Territory Secured' : 'Clean Run'),
    );
    const outer = (await summary.boundingBox())!;
    const score = (await summary.locator('strong').boundingBox())!;
    expect(score.x).toBeGreaterThanOrEqual(outer.x);
    expect(score.x + score.width).toBeLessThanOrEqual(
      outer.x + outer.width + 1,
    );
    await page.screenshot({
      path: testInfo.outputPath(`small-result-${mistakes}.png`),
    });
    await slideToNext(page);
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-label',
      /Puzzle level 2,/,
    );
    await expect(page.getByRole('grid')).not.toHaveClass(/board-assembling/);
    for (const cell of second.solutionCells) {
      await page
        .locator(`[data-cell-index="${cell}"]`)
        .click({ button: 'right' });
      await page.waitForTimeout(420);
    }
    await expect(slider).toHaveAttribute('aria-disabled', 'false');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await slideToNext(page);
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-label',
      /Puzzle level 3,/,
    );
    await expect(
      page.getByRole('button', { name: 'Hint', exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole('grid')).toHaveAttribute(
      'aria-label',
      /Puzzle level 3,/,
    );
  });
}
