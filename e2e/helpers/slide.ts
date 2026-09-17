import { expect, type Page } from '@playwright/test';

export async function slideToNext(page: Page, fraction = 0.9, release = true) {
  const handle = page.getByRole('slider', { name: 'Slide to next level' });
  await expect(handle).toHaveAttribute('aria-disabled', 'false');
  const track = (await page.getByTestId('next-level-slide').boundingBox())!;
  // Use the resting hit target; callers wait for snap-back when testing repeats.
  const thumb = (await handle.boundingBox())!;
  const x = thumb.x + thumb.width / 2,
    y = thumb.y + thumb.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (track.width - thumb.width) * fraction, y, {
    steps: 12,
  });
  if (release) await page.mouse.up();
}
