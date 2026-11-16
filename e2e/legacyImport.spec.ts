import { expect, test, type Page } from '@playwright/test';

const OLD_REP = {
  id: 'legacy-slav-1', profileId: 'legacy-player-1', name: 'Slav Black (old app)',
  side: 'black', positions: {}, notes: {}, cards: {
    'some-position|c7c6': {
      due: 1770000000000, stability: 24, difficulty: 5, elapsed_days: 30,
      scheduled_days: 35, learning_steps: 0, reps: 7, lapses: 1,
      state: 2, last_review: 1760000000000,
    },
  }, engine: {}, study: true, paused: true,
  createdAt: 1700000000000, updatedAt: 1760000000000,
};

async function makeOldDatabase(page: Page) {
  await page.goto('/');
  await page.evaluate(async (rep) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('repertoire-data', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('app');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const data = {
      version: 1, profiles: [{ id: 'legacy-player-1', name: 'Old player', color: '#467c50', ratings: [1500], speeds: ['rapid'] }],
      repertoires: [rep], activeProfileId: 'legacy-player-1', activeRepId: rep.id,
      lastBackupAt: null, deleted: {},
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('app', 'readwrite');
      tx.objectStore('app').put(data, 'data');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, OLD_REP);
  await page.reload();
}

test('old app discovery is optional and imports SRS without modifying the old database', async ({ page }) => {
  await makeOldDatabase(page);
  const dialog = page.getByRole('dialog', { name: 'Move your Repertoire 1 studies?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Slav Black (old app)');
  await expect(dialog).toContainText('1/1 moves reviewed');
  await expect(dialog).toContainText('SRS paused');
  await dialog.getByRole('button', { name: 'Import missing data' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.studio-repertoire-grid')).toContainText('Slav Black (old app)');
  const repCard = page.locator('.rep-card').filter({ hasText: 'Slav Black (old app)' });
  await expect(repCard.getByRole('button', { name: 'Study' })).toHaveAttribute('aria-pressed', 'true');
  await expect(repCard.getByRole('checkbox', { name: /SRS training for Slav Black/ })).not.toBeChecked();
  const state = await page.evaluate(async () => {
    const read = async (dbName: string) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const tx = db.transaction('app','readonly');
        const req = tx.objectStore('app').get('data');
        req.onsuccess = () => resolve(req.result as Record<string, unknown>);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return result;
    };
    const old = await read('repertoire-data');
    const newer = await read('repertoire2-data');
    return { old, newer };
  });
  const oldRep = (state.old.repertoires as typeof OLD_REP[])[0];
  const newRep = (state.newer.repertoires as typeof OLD_REP[])[0];
  expect(oldRep.cards['some-position|c7c6'].reps).toBe(7);
  expect(oldRep.updatedAt).toBe(1760000000000);
  expect(newRep.cards['some-position|c7c6'].stability).toBe(24);
  expect(newRep.cards['some-position|c7c6'].last_review).toBe(1760000000000);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Move your Repertoire 1 studies?' })).toHaveCount(0);
});

test('Not now persists, but importing later from Settings remains possible', async ({ page }) => {
  await makeOldDatabase(page);
  const dialog = page.getByRole('dialog', { name: 'Move your Repertoire 1 studies?' });
  await dialog.getByRole('button', { name: 'Not now' }).click();
  await page.reload();
  await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder('Name').fill('New player');
  await page.getByRole('button', { name: 'Get started' }).click();
  const sidebar = page.locator('.topbar .nav .studio-nav-settings');
  if (await sidebar.isVisible()) await sidebar.click();
  else await page.locator('.topbar .topbar-settings').click();
  await expect(page.locator('#studio-settings-import')).toBeVisible();
  await page.getByRole('button', { name: 'Find old app in this browser' }).click();
  await expect(page.getByRole('dialog', { name: 'Move your Repertoire 1 studies?' })).toBeVisible();
});
