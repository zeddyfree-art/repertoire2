import { expect, test } from '@playwright/test';
import { go, move, start } from './helpers';

const SAMPLE = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 *';
const SIZES = [320, 360, 375, 390, 430, 768];

async function noOverflow(page: import('@playwright/test').Page, screen: string, width: number) {
  const check = await page.evaluate(() => {
    const root = document.documentElement;
    const offenders = [...document.querySelectorAll<HTMLElement>('*')].map((el) => {
      const rect = el.getBoundingClientRect();
      const name = el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.slice(0, 68).replace(/\s+/g,'.') : '');
      return { name, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), scroll: el.scrollWidth - el.clientWidth };
    }).filter((v) => v.right > root.clientWidth + 2 || v.left < -2 || v.scroll > 3)
      .sort((a, b) => b.right - a.right).slice(0, 12);
    return { overflow: root.scrollWidth - root.clientWidth, inner: window.innerWidth, offenders };
  });
  if (check.overflow > 1) console.log('ROUND_A_OVERFLOW ' + JSON.stringify({screen,width,check}));
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

test('light mode restores original logo and keeps Repertoire 2 branding', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Light theme' }).click();
  const original = page.locator('.studio-brand-original');
  const compact = page.locator('.studio-knight-light');
  await expect(original.or(compact).first()).toBeAttached();
  await expect(page.locator('.studio-brand')).toContainText('Repertoire 2');
  await expect(page).toHaveTitle('Repertoire 2');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Repertoire 2');
  const artwork = await (await page.request.get('/brand-lockup-v2.svg')).text();
  expect(artwork).toContain('viewBox="0 0 992 305"');
});

test('Home and Today offer warned repertoire moves before they are due without changing SRS cards', async ({ page }) => {
  await start(page, { name: 'Scotch', pgn: SAMPLE });
  const home = page.getByRole('region', { name: "Today's training" });
  await expect(home.getByRole('button', { name: 'Practise frequent mistakes (0)' })).toBeDisabled();

  const savedCards = (seed: boolean) => page.evaluate(async (seed) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('repertoire2-data');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise<Record<string, unknown>>((resolve, reject) => {
        const tx = db.transaction('app', seed ? 'readwrite' : 'readonly');
        const store = tx.objectStore('app');
        const req = store.get('data');
        tx.oncomplete = () => resolve(req.result.repertoires[0].cards);
        tx.onerror = () => reject(tx.error);
        req.onsuccess = () => {
          if (!seed) return;
          const data = req.result;
          const cards = data.repertoires[0].cards;
          const first = Object.keys(cards).find((id) => id.endsWith('|e2e4'))!;
          Object.assign(cards[first], { state: 2, lapses: 4, due: Date.now() + 86400000 });
          store.put(data, 'data');
        };
      });
    } finally {
      db.close();
    }
  }, seed);

  const before = await savedCards(true);
  await page.reload();
  await go(page, 'Overview');
  await home.getByRole('button', { name: 'Practise frequent mistakes (1)' }).click();
  await expect(page.getByRole('button', { name: 'Hint' })).toBeEnabled();
  await move(page, 'e2', 'e4');
  await expect(page.getByRole('heading', { name: 'Frequent mistakes practised' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByRole('button', { name: 'Review (0)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Practise frequent mistakes (1)' }).click();
  await expect(page.getByRole('button', { name: 'Hint' })).toBeEnabled();
  await page.getByRole('button', { name: 'Stop' }).click();
  expect(await savedCards(false)).toEqual(before);
});
