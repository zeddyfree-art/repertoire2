import { expect, test } from '@playwright/test';
import { go, start } from './helpers';

const SLAV = '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 a6 *';

test('Play, Games and Check have cohesive Warm Studio workspaces and working controls', async ({ page }) => {
  await start(page, { name: 'Slav Black', side: 'black', pgn: SLAV });

  await go(page, 'Play');
  await expect(page.locator('.studio-workspace-play')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Play against Maia' })).toBeVisible();
  await expect(page.locator('.studio-play-modes')).toBeVisible();
  await page.getByRole('button', { name: /Casual practice/ }).click();
  await expect(page.getByRole('button', { name: /Casual practice/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Rated challenge/ }).click();
  await expect(page.getByRole('button', { name: /Rated challenge/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Start game|Download Maia/ })).toBeVisible();

  await go(page, 'Games');
  await expect(page.locator('.studio-workspace-games')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your games & insights' })).toBeVisible();
  await expect(page.locator('.studio-games-library')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add your first games' })).toBeVisible();

  await go(page, 'Check');
  await expect(page.locator('.studio-workspace-audit')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Check your preparation' })).toBeVisible();
  await expect(page.locator('.studio-audit-summary .studio-audit-fact')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^Find gaps$/ })).toBeVisible();
});

test('Settings, About and onboarding stay accessible on laptop and phone', async ({ page }) => {
  await start(page);
  const sidebarSettings = page.locator('.topbar .nav .studio-nav-settings');
  if (await sidebarSettings.isVisible()) await sidebarSettings.click();
  else await page.locator('.topbar .topbar-settings').click();

  await expect(page.locator('.studio-workspace-settings')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settings & preferences' })).toBeVisible();
  await expect(page.locator('.studio-settings-jumps button')).toHaveCount(6);
  await page.locator('.studio-settings-jumps').getByRole('button', { name: 'Appearance' }).click();
  await expect(page.locator('#studio-settings-appearance')).toBeVisible();
  await expect(page.locator('#studio-settings-backup')).toHaveCount(1);

  await page.locator('a[href="#about"]').first().click();
  await expect(page.locator('.studio-about')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About Repertoire' })).toBeVisible();
});

test('all seven primary screens and Settings fit viewport with no horizontal page overflow', async ({ page }) => {
  await start(page, { name: 'Slav Black', side: 'black', pgn: SLAV });
  for (const view of ['Overview', 'Train', 'Build', 'Tree', 'Play', 'Games', 'Check'] as const) {
    await go(page, view);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, view).toBeLessThanOrEqual(1);
  }
  const sidebarSettings = page.locator('.topbar .nav .studio-nav-settings');
  if (await sidebarSettings.isVisible()) await sidebarSettings.click();
  else await page.locator('.topbar .topbar-settings').click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'Settings').toBeLessThanOrEqual(1);
});
