import { expect, test } from '@playwright/test';
import { move, start } from './helpers';

// Offline (see helpers): the drill falls back to Stockfish in the browser, which is what a phone without a
// connection gets too.
test('endgames: from Home to a drill, a mistake is taken back', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: /^Endgames/ }).first().click();
  await expect(page.getByText('YOUR ENDGAME SCORE')).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue: King and queen against king/ })).toBeVisible();

  await page.locator('.eg-drill-row', { hasText: 'King on the sixth' }).first().click();
  await expect(page.getByText('Queen the pawn. Only two moves win here.')).toBeVisible();
  await expect(page.getByText('Your move (White)')).toBeVisible({ timeout: 30_000 });
  // Kd5 lets Black take the opposition: a draw, so it is taken back.
  await move(page, 'e6', 'd5');
  await expect(page.locator('.feedback.bad')).toContainText('Kd5?', { timeout: 30_000 });
  await expect(page.getByText('Your move (White)')).toBeVisible({ timeout: 10_000 });
  // Stopping after a mistake counts as a miss: the drill is due again, and listed under "Still to train".
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('.eg-drill-row', { hasText: 'King on the sixth' }).first()).toContainText('practise again');
  await expect(page.locator('.eg-weak-item', { hasText: 'King on the sixth' })).toBeVisible();
});
