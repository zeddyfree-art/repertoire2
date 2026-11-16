import { expect, test } from '@playwright/test';
import { start } from './helpers';

test('the generated knight and wordmark are displayed with correct branding', async ({ page }, info) => {
  await start(page);
  await page.getByRole('button', { name: 'Light theme' }).click();

  const logo = page.locator('.studio-brand-logo');
  const knight = page.locator('.studio-brand-knight');
  await expect(page.locator('.studio-brand')).toBeVisible();
  await expect(logo).toHaveAttribute('src', /brand-lockup-v2\.svg$/);
  await expect(knight).toHaveAttribute('src', /brand-knight\.svg$/);
  for (const asset of [logo, knight]) {
    await expect.poll(async () => asset.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }

  if (info.project.name === 'desktop') {
    await expect(logo).toBeVisible();
  } else {
    await expect(knight).toBeVisible();
  }

  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(knight).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('browser and installed app metadata point to new versioned icons', async ({ page }) => {
  await page.goto('/');
  const favicon = page.locator('link[rel="icon"]');
  await expect(favicon).toHaveAttribute('href', /brand-knight\.svg\?v=brand2/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest\?v=brand2/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-touch-icon-v2\.png/);

  const response = await page.request.get('/manifest.webmanifest?v=brand2');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
    'icon-192-v2.png', 'icon-512-v2.png', 'icon-maskable-512-v2.png', 'brand-knight.svg',
  ]);
  const svg = await page.request.get('/brand-knight.svg');
  expect(svg.ok()).toBe(true);
  expect(await svg.text()).toContain('data:image/jpeg;base64,');
});
