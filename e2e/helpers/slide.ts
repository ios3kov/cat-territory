import { expect, type Page } from '@playwright/test';

export async function slideToNext(page: Page, fraction = 0.9, release = true) {
  const handle = page.getByRole('slider', { name: 'Slide to next level' });
  await expect(handle).toHaveAttribute('aria-disabled', 'false');
  const track = (await page.getByTestId('next-level-slide').boundingBox())!;
  // The state resets before the CSS spring finishes; wait for the actual hit area.
  await handle.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => {
      const b = await handle.boundingBox();
      return b ? Math.abs(b.x - track.x) : Infinity;
    })
    .toBeLessThan(0.5);
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
