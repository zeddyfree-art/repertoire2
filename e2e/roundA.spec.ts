import { expect, test } from '@playwright/test';
import { go, start } from './helpers';

const SAMPLE = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 *';
const SIZES = [320, 360, 375, 390, 430, 768];

async function noOverflow(page: import('@playwright/test').Page, screen: string, width: number) {
  const check = await page.evaluate(() => {
    const root = document.documentElement;
    return { overflow: root.scrollWidth - root.clientWidth, inner: window.innerWidth };
  });
  expect(check.overflow, `${screen} width=${width} viewport=${check.inner}`).toBeLessThanOrEqual(1);
}

test('all primary pages and an active training board fit narrow phone sizes without page scrolling sideways', async ({ page }) => {
  await start(page, { name: 'Scotch', pgn: SAMPLE });
  for (const width of SIZES) {
    await page.setViewportSize({ width, height: width >= 768 ? 1024 : 812 });
    for (const view of ['Overview', 'Build', 'Tree', 'Train', 'Play', 'Games', 'Check'] as const) {
      await go(page, view);
      await noOverflow(page, view, width);
    }
    const settings = page.locator('.topbar .topbar-settings');
    if (await settings.isVisible()) await settings.click();
    else await page.locator('.topbar .nav .studio-nav-settings').click();
    await noOverflow(page, 'Settings', width);

    await go(page, 'Train');
    await page.getByRole('button', { name: 'Start learning' }).click();
    await expect(page.locator('.train cg-board')).toBeVisible();
    await noOverflow(page, 'Active learning', width);
    const box = await page.locator('.train cg-board').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x, 'board starts inside viewport').toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, 'board ends inside viewport').toBeLessThanOrEqual(width + 1);
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
    await page.locator('.train-panel').getByRole('button', { name: 'Stop' }).click();
    await expect(page.locator('.studio-train-entry-actions')).toBeVisible();
    await noOverflow(page, 'Training exit', width);
  }
});

test('Review has no new cards; Learn has one repertoire selector and stopping leaves untrained cards intact', async ({ page }) => {
  await start(page, { name: 'Scotch', pgn: SAMPLE });
  await go(page, 'Train');
  await expect(page.getByRole('button', { name: 'Review (0)' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Learn new moves' })).toBeVisible();
  await expect(page.getByLabel('Repertoire to learn')).toHaveCount(1);
  await page.getByRole('button', { name: 'Start learning' }).click();
  await expect(page.locator('.train cg-board')).toBeVisible();
  await expect(page.locator('.train-panel')).toContainText('New move');
  await page.locator('.train-panel').getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('.studio-train-entry-actions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review (0)' })).toBeDisabled();
  await expect(page.getByLabel('Repertoire to learn')).toContainText('new');
});

test('light theme logo is transparent and brand has no Warm Studio product naming', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Light theme' }).click();
  await expect(page.locator('.studio-knight-light')).toBeVisible();
  await expect(page.locator('.studio-brand')).toContainText('Repertoire 2');
  await expect(page).toHaveTitle('Repertoire 2');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Repertoire 2');
  const text = await (await page.request.get('/brand-transparent.svg')).text();
  expect(text).not.toContain('data:image/jpeg');
});
