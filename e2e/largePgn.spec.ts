import { expect, test } from '@playwright/test';
import { go, start } from './helpers';
import { largePgnFixture } from '../src/lib/largePgnFixture';

test('a large annotated multi-chapter PGN creates a repertoire and opens in Build/Tree/Train', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'Heavy 185-chapter file is checked on desktop; mobile navigation covered separately.');
  await start(page, { name: 'Synthetic Caro-Kann stress', side: 'black', pgn: largePgnFixture() });
  await go(page, 'Overview');
  await expect(page.locator('.rep-card').filter({ hasText: 'Synthetic Caro-Kann stress' })).toBeVisible();
  for (const view of ['Build', 'Tree', 'Train'] as const) {
    await go(page, view);
    await expect(page.locator('body')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, view).toBeLessThanOrEqual(1);
  }
  await page.reload();
  await go(page, 'Overview');
  await expect(page.locator('.rep-card').filter({ hasText: 'Synthetic Caro-Kann stress' })).toBeVisible();
});
