import { test, expect } from '@playwright/test';
import { start, go } from './helpers';

const REP = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 *';

async function report(page: import('@playwright/test').Page, name: string) {
  const info = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vwInner = window.innerWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>('*')].flatMap((e) => {
      const rect = e.getBoundingClientRect();
      const css = getComputedStyle(e);
      const delta = e.scrollWidth - e.clientWidth;
      const spills = rect.left < -2 || rect.right > vw + 2;
      const scroll = delta > 3 && e.clientWidth > 0;
      if (!spills && !scroll) return [];
      const name = e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().replace(/\s+/g,'.').slice(0,72) : '');
      return [{ name, width: Math.round(rect.width), left: Math.round(rect.left), right: Math.round(rect.right), scrollDelta: delta, overflowX: css.overflowX, display: css.display }];
    });
    return { vw, vwInner, rootOverflow: document.documentElement.scrollWidth - vw, bodyOverflow: document.body.scrollWidth - vw, offenders: offenders.sort((a,b) => b.scrollDelta - a.scrollDelta).slice(0,18) };
  });
  console.log('UX_AUDIT ' + JSON.stringify({ name, ...info }));
  return info;
}

test('diagnostic: phone and laptop overflow on the major workflows', async ({ page }, testInfo) => {
  await start(page, { name: 'UX audit repertoire', side: 'white', pgn: REP });
  await go(page, 'Overview');
  await report(page, 'Home');
  for (const view of ['Build','Tree','Train','Play','Games','Check'] as const) {
    await go(page, view);
    await report(page, view);
  }
  await go(page, 'Train');
  await page.locator('.studio-back-home').click();
  await page.locator('.studio-training-button').click();
  await expect(page.locator('.train')).toBeVisible();
  await report(page, 'Training session active');
  const board = await page.locator('.train cg-board').first().boundingBox();
  console.log('UX_BOARD ' + JSON.stringify({project:testInfo.project.name,board, viewport:page.viewportSize()}));
  const rootOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('UX_ROOT_OVERFLOW ' + rootOverflow);
});
