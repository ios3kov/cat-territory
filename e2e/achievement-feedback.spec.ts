import { expect, test, type Page } from '@playwright/test';
import { levelData } from './helpers/generatedLevel';

const levelOne = levelData(0);

async function startAlmostWon(page: Page) {
  const board = Array(levelOne.level.size * levelOne.level.size).fill(0);
  for (const index of levelOne.solutionCells.slice(0, -1)) board[index] = 2;
  await page.addInitScript(
    ({ seededBoard, sessionKey }) => {
      localStorage.setItem('cat-territory-progress-migrated-v3', '1');
      localStorage.setItem('cat-territory-current-level-v3', '0');
      localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
      localStorage.removeItem('cat-territory-achievements-v2');
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          board: seededBoard,
          history: [],
          seconds: 35,
          started: true,
          mistakes: 0,
          usedHint: false,
        }),
      );
    },
    { seededBoard: board, sessionKey: levelOne.sessionKey },
  );
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.locator('.board .cat-face')).toHaveCount(
    levelOne.level.size - 1,
  );
}

test('achievement unlocks stay in the header and never cover the game', async ({
  page,
}) => {
  await startAlmostWon(page);
  await page
    .locator(`[data-cell-index="${levelOne.solutionCells.at(-1)!}"]`)
    .click({ button: 'right' });

  await expect(page.locator('.achievement-toast')).toHaveCount(0);
  const inline = page.locator('.achievement-inline');
  await expect(inline).toBeVisible();
  await expect(inline).toContainText('New achievement');
  await expect(inline).toContainText('First Territory');

  const achievements = page.getByRole('button', {
    name: /Progress and achievements/,
  });
  await expect(achievements).toHaveAttribute(
    'aria-label',
    /3 unlocked, new achievement/,
  );
  await expect(achievements.locator('.achievement-gain')).toHaveText('+1');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect(page.locator('.slide-handle')).toHaveAttribute(
    'data-disabled',
    'false',
  );
  await expect(page.locator('.completion-summary')).toBeVisible();
  await expect(page.locator('.achievement-inline')).toHaveCount(0);
  await expect(achievements.locator('.achievement-gain')).toHaveText('+1');
});

test('reduced motion keeps the quiet achievement feedback readable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startAlmostWon(page);
  await page
    .locator(`[data-cell-index="${levelOne.solutionCells.at(-1)!}"]`)
    .click({ button: 'right' });
  await expect(page.locator('.achievement-toast')).toHaveCount(0);
  await expect(page.locator('.achievement-gain')).toHaveText('+1');
  await expect(page.locator('.slide-handle')).toHaveAttribute(
    'data-disabled',
    'false',
  );
  await expect(page.locator('.completion-summary')).toBeVisible();
});
