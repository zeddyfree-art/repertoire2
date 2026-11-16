import { expect, test } from '@playwright/test';
import { go, start } from './helpers';

const SLAV_SAMPLE = '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 a6 *';

test('Build, Tree and Train share Warm Studio identity while keeping controls', async ({ page }) => {
  await start(page, { name: 'Slav – Black', side: 'black', pgn: SLAV_SAMPLE });

  await expect(page.locator('.studio-workspace-build')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Build your repertoire' })).toBeVisible();
  await expect(page.locator('.studio-workspace-chip')).toContainText('Slav');
  await expect(page.locator('.build cg-board')).toBeVisible();
  await expect(page.locator('.build .board-controls')).toBeVisible();
  await expect(page.locator('.build .side-panel')).toBeVisible();

  await go(page, 'Tree');
  await expect(page.locator('.studio-workspace-tree')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Explore your repertoire' })).toBeVisible();
  await expect(page.locator('.tree-svg')).toBeVisible();
  await expect(page.locator('.tree-toolbar')).toBeVisible();

  await go(page, 'Train');
  await expect(page.locator('.studio-workspace-train')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Train with purpose' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Today');

  await page.locator('.studio-back-home').click();
  await expect(page.locator('.studio-dashboard')).toBeVisible();
});

test('Warm Studio workspaces fit desktop and phone widths', async ({ page }) => {
  await start(page, { name: 'Slav – Black', side: 'black', pgn: SLAV_SAMPLE });
  for (const view of ['Build', 'Tree', 'Train'] as const) {
    await go(page, view);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, view).toBeLessThanOrEqual(1);
  }
});

test('new brand SVG is present and the generated hero image is available', async ({ page }) => {
  await start(page);
  await expect(page.locator('.topbar .studio-logo-mark img')).toBeVisible();
  const photo = await page.request.get('/warm-studio-hero.jpg');
  expect(photo.ok()).toBeTruthy();
  expect(photo.headers()['content-type']).toContain('image/jpeg');
});
