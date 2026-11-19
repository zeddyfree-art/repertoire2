import { expect, test } from '@playwright/test';
import { start } from './helpers';

test('the light theme uses a genuinely transparent vector logo, dark theme preserves legibility', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Light theme' }).click();
  const light = page.locator('.studio-knight-light');
  const dark = page.locator('.studio-knight-dark');
  await expect(page.locator('.studio-brand')).toBeVisible();
  await expect(light).toBeVisible();
  await expect(dark).toBeHidden();
  await expect(page.locator('.studio-brand')).toContainText('Repertoire 2');
  await expect.poll(() => light.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const transparentSvg = await (await page.request.get('/brand-transparent.svg')).text();
  expect(transparentSvg).not.toContain('data:image/jpeg');
  expect(transparentSvg).not.toContain('<rect width="512" height="512" rx="112" fill="url(#forest)"/>');
  expect(transparentSvg).toContain('<path fill="url(#ivory)"');
  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(dark).toBeVisible();
  await expect(light).toBeHidden();
});

test('browser metadata and installed PWA identify the app as Repertoire 2', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Repertoire 2');
  const favicon = page.locator('link[rel="icon"]');
  await expect(favicon).toHaveAttribute('href', /brand-transparent\.svg\?v=round-a/);
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe('Repertoire 2');
  expect(manifest.short_name).toBe('Repertoire 2');
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toContain('brand-transparent.svg?v=round-a');
  for (const asset of manifest.icons) {
    const resource = await page.request.get('/' + asset.src);
    expect(resource.ok(), asset.src).toBe(true);
  }
});
