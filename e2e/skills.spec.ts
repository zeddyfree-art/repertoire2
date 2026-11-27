import { expect, test } from '@playwright/test';
import { start } from './helpers';

// Offline (see helpers): the tactics path asks for a start rating, and says so plainly when Lichess cannot be reached.
test('skills: tabs, start rating, and an offline set', async ({ page }) => {
  await start(page);
  await page.locator('nav.nav button[title="Skills"]').click();
  await expect(page.getByRole('tab', { name: /Tactics/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByLabel('Start rating').fill('1750');
  await page.getByRole('button', { name: 'Start with 1750' }).click();
  await expect(page.getByText('TACTICS RATING')).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue: Learn · Hanging piece/ })).toBeVisible();

  await page.getByRole('button', { name: /Continue: Learn/ }).click();
  await expect(page.getByText(/Lichess could not be reached/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('tab', { name: /Calculation/ }).click();
  await expect(page.getByRole('heading', { name: 'Mate ladder' })).toBeVisible();
  await page.getByRole('tab', { name: /Endgames/ }).click();
  await expect(page.getByText('YOUR ENDGAME SCORE')).toBeVisible();
});
