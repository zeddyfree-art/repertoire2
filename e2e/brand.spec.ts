import { expect, test } from '@playwright/test';
import { start } from './helpers';

test('the restored original light-mode logo stays intact on desktop and mobile', async ({ page }, info) => {
  await start(page);
  await page.getByRole('button', { name: 'Light theme' }).click();
  const original = page.locator('.studio-brand-original');
  const compact = page.locator('.studio-knight-light');
  await expect(page.locator('.studio-brand')).toBeVisible();
  if (info.project.name === 'desktop') {
    await expect(original).toBeVisible();
    await expect(compact).toBeHidden();
  } else {
    await expect(original).toBeHidden();
    await expect(compact).toBeVisible();
    await expect(page.locator('.studio-brand')).toContainText('Repertoire 2');
  }
  const visible = info.project.name === 'desktop' ? original : compact;
  await expect.poll(async () => visible.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await visible.getAttribute('src')).toMatch(info.project.name === 'desktop' ? /brand-lockup-v2\.svg\?v=round-b$/ : /brand-knight\.svg\?v=round-b$/);
  const svg = await (await page.request.get('/brand-lockup-v2.svg')).text();
  expect(svg).toContain('viewBox="0 0 992 305"');
  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(page.locator('.studio-knight-dark')).toBeVisible();
  await expect(original).toBeHidden();
});

test('PWA metadata retains product identity and installed icon compatibility', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Repertoire 2');
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe('Repertoire 2');
  expect(manifest.short_name).toBe('Repertoire 2');
  for (const asset of manifest.icons) {
    const resource = await page.request.get('/' + asset.src);
    expect(resource.ok(), asset.src).toBe(true);
  }
});
