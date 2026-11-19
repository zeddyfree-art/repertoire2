import { test, expect } from '@playwright/test';
import { go, start } from './helpers';

const PGN = '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 *';

test('Home prioritizes Today, Continue and Progress; no heavy board on phone', async ({ page }, info) => {
  await start(page, { name: 'Scotch Game', pgn: PGN });
  await go(page, 'Overview');
  const sections = await page.locator('.studio-dashboard-flow > *').evaluateAll((nodes) => nodes.map((n) => {
    if (n.classList.contains('studio-training-hero')) return 'today';
    if (n.classList.contains('studio-continue-card')) return 'continue';
    if (n.classList.contains('studio-progress-card')) return 'progress';
    if (n.classList.contains('studio-kpi-row')) return 'metrics';
    if (n.classList.contains('studio-featured-card')) return 'preview';
    return 'unknown';
  }));
  expect(sections).toEqual(['today','continue','progress','metrics','preview']);
  await expect(page.getByRole('button', { name: /Review/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Learn new moves' })).toBeVisible();
  if (info.project.name === 'phone') {
    await expect(page.locator('.studio-featured-card')).toBeHidden();
  } else {
    await expect(page.locator('.studio-featured-card cg-board')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Learn new moves' }).click();
  await expect(page.getByRole('button', { name: 'Start learning' })).toBeVisible();
});

test('repertoire selector exists only where a specific opening is being worked on', async ({ page }) => {
  await start(page, { name: 'Scotch Game', pgn: PGN });
  await go(page, 'Overview');
  await expect(page.locator('.topbar .rep-select')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Working repertoire' })).toHaveCount(0);
  for (const view of ['Build','Tree','Check'] as const) {
    await go(page, view);
    await expect(page.getByRole('combobox', { name: 'Working repertoire' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Working repertoire' })).toContainText('Scotch Game');
  }
  await go(page, 'Train');
  await expect(page.getByRole('combobox', { name: 'Working repertoire' })).toHaveCount(0);
  await go(page, 'Play');
  await expect(page.getByRole('combobox', { name: 'Working repertoire' })).toHaveCount(0);
});

test('Rename works from repertoire card, Settings is only global configuration', async ({ page }) => {
  await start(page, { name: 'Scotch Game', pgn: PGN });
  await go(page, 'Overview');
  const card = page.locator('.rep-card').filter({ hasText: 'Scotch Game' });
  await card.getByRole('button', { name: 'More for Scotch Game' }).click();
  await page.getByRole('menuitem', { name: 'Rename repertoire…' }).click();
  await page.getByRole('textbox', { name: 'New repertoire name' }).fill('Scotch Open Games');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.locator('.rep-card')).toContainText('Scotch Open Games');
  await go(page, 'Build');
  await expect(page.getByRole('combobox', { name: 'Working repertoire' })).toContainText('Scotch Open Games');
  const settings = page.locator('.topbar .topbar-settings');
  if (await settings.isVisible()) await settings.click();
  else await page.locator('.topbar .nav .studio-nav-settings').click();
  await expect(page.getByRole('heading', { name: /Repertoire: Scotch/ })).toHaveCount(0);
  await expect(page.locator('#studio-settings-backup')).toBeVisible();
  await expect(page.locator('#studio-settings-import')).toHaveCount(1);
});

test('phase B retains mobile fit on Home and contextual workspace headers', async ({ page }) => {
  await start(page, { name: 'Scotch Game', pgn: PGN });
  for (const width of [320,375,390,430,768]) {
    await page.setViewportSize({ width, height: 812 });
    for (const view of ['Overview','Build','Tree','Train','Play','Games','Check'] as const) {
      await go(page, view);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${view} at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
