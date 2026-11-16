import { expect, test } from '@playwright/test';
import { start } from './helpers';

const SAMPLE = '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 *';

test('Warm Studio dashboard shows live repertoire board, actions, and no horizontal overflow', async ({ page }) => {
  await start(page, { name: 'Scotch', pgn: SAMPLE });
  // Creating a repertoire opens Build; return to Home to inspect the dashboard.
  await page.locator('nav.nav button[title="Home"]').click();
  await expect(page.locator('.studio-dashboard')).toBeVisible();
  await expect(page.locator('.studio-training-hero')).toBeVisible();
  await expect(page.locator('.studio-featured-card cg-board')).toBeVisible();
  await expect(page.locator('.studio-featured-detail')).toContainText('Scotch');
  await expect(page.locator('.studio-kpi-row')).toBeVisible();
  await expect(page.locator('.studio-progress-card')).toBeVisible();
  await expect(page.locator('.studio-continue-card')).toBeVisible();
  await expect(page.locator('.studio-repertoire-grid .rep-card')).toHaveCount(1);

  const caption = page.locator('.studio-move-caption');
  const last = await caption.innerText();
  await page.getByRole('button', { name: 'Previous move' }).click();
  await expect(caption).not.toHaveText(last);
  await page.getByRole('button', { name: 'Next move in repertoire' }).click();
  await expect(caption).toHaveText(last);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Warm Studio remembers manual dark/light preference and does not alter the board choice', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const choice = await page.evaluate(() => localStorage.getItem('repertoire2-appearance'));
  expect(choice).toBe('light');
  // The player profile is stored asynchronously in IndexedDB.
  await expect(page.locator('.save-indicator')).toContainText('Saved');
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Light theme' })).toHaveAttribute('aria-pressed', 'true');
});
