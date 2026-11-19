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
  const favicon = page.locator('head link[rel="icon"]');
  await expect(favicon).toHaveAttribute('href', 'favicon-32-v4.png');
  await expect(favicon).toHaveAttribute('type', 'image/png');
  const faviconResponse = await page.request.get('/favicon-32-v4.png');
  expect(faviconResponse.ok()).toBe(true);
  expect(faviconResponse.headers()['content-type']).toContain('image/png');
  await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'apple-touch-icon-v4.png');
  expect((await page.request.get('/apple-touch-icon-v4.png')).ok()).toBe(true);
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe('Repertoire 2');
  expect(manifest.short_name).toBe('Repertoire 2');
  expect(manifest.icons).toHaveLength(3);
  expect(manifest.icons.map((asset: { src: string }) => asset.src)).toEqual([
    'icon-192-v4.png', 'icon-512-v4.png', 'icon-maskable-512-v4.png',
  ]);
  for (const asset of manifest.icons) {
    const resource = await page.request.get('/' + asset.src);
    expect(resource.ok(), asset.src).toBe(true);
  }
});


test('favicon and original-brand app icons are visible and visually nonblank', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const paths = ['/favicon-32-v4.png', '/icon-192-v4.png', '/icon-512-v4.png', '/icon-maskable-512-v4.png'];
    return Promise.all(paths.map(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set<string>();
      for (let i = 0; i < rgba.length; i += 4 * Math.max(1, Math.floor(rgba.length / 4 / 1024))) {
        colors.add(rgba[i] + ',' + rgba[i+1] + ',' + rgba[i+2] + ',' + rgba[i+3]);
      }
      return { src, width: canvas.width, height: canvas.height, colors: colors.size };
    }));
  });
  expect(results.map((icon) => icon.width)).toEqual([32,192,512,512]);
  expect(results.every((icon) => icon.width === icon.height && icon.colors > 5), JSON.stringify(results)).toBe(true);
});
