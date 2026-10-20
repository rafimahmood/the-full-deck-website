// Installable app and offline use, on an iPhone 14.
//
//   npm run test:e2e:pwa                 (WebKit: iPhone tags, icons, service worker, offline)
//   npm run test:e2e:pwa -- chromium     (adds Chrome's own installability check)
//
// Playwright can't tap "Add to Home Screen", so the iPhone checks cover everything Safari reads
// when you do: the tags, the 180px touch icon, the manifest, and that the app opens offline.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { engineFromArgs, launch, reporter, startServer } from './lib.mjs';

const engine = engineFromArgs();
const site = await startServer();
const browser = await launch(engine);
const { check, done } = reporter();
const shots = process.env.E2E_SHOTS; // optional folder for screenshots

const ctx = await browser.newContext({ ...devices['iPhone 14'] });
// A consent choice is already made, so the banner doesn't get in the way.
await ctx.addInitScript(() => localStorage.setItem('fd-consent', JSON.stringify({ choice: 'denied', at: Date.now() })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto(`${site.base}/deck-app.html`);
  await page.waitForSelector('.list-row');

  // ---- what Safari reads for Add to Home Screen ----
  const head = await page.evaluate(async () => {
    const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content ?? null;
    const touch = document.querySelector('link[rel="apple-touch-icon"]');
    const size = await new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = touch.href; });
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const manifest = await (await fetch(manifestLink.href)).json();
    const icons = await Promise.all(manifest.icons.map(async (i) => {
      const s = await new Promise((res) => { const im = new Image(); im.onload = () => res(`${im.naturalWidth}x${im.naturalHeight}`); im.onerror = () => res(null); im.src = new URL(i.src, manifestLink.href).href; });
      return { declared: i.sizes, actual: s };
    }));
    return { capable: meta('apple-mobile-web-app-capable'), title: meta('apple-mobile-web-app-title'), theme: meta('theme-color'), touchHref: touch.getAttribute('href'), touchSize: size, manifest, icons };
  });
  check('iPhone: apple-mobile-web-app-capable is yes', head.capable === 'yes');
  check('iPhone: home-screen title is "Full Deck"', head.title === 'Full Deck');
  check('iPhone: apple-touch-icon loads and is 180x180', head.touchSize?.join('x') === '180x180', String(head.touchSize));
  check('theme-color is the brand orange', head.theme === '#B5482A');
  check('manifest: name, short name, start URL, display, colours', head.manifest.name === 'The Full Deck' && head.manifest.short_name === 'Full Deck' && head.manifest.start_url === '/deck-app.html' && head.manifest.display === 'standalone' && head.manifest.background_color === '#F6F1E7' && head.manifest.theme_color === '#B5482A');
  check('manifest: 192 and 512 icons load at their declared sizes', head.icons.length === 2 && head.icons.every((i) => i.declared === i.actual), JSON.stringify(head.icons));
  for (const p of ['index.html', 'privacy.html']) {
    await page.goto(`${site.base}/${p}`);
    const tags = await page.evaluate(() => ({ m: !!document.querySelector('link[rel=manifest]'), t: !!document.querySelector('link[rel=apple-touch-icon]'), c: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content }));
    check(`${p}: manifest and iOS tags present`, tags.m && tags.t && tags.c === 'yes');
  }
  await page.goto(`${site.base}/deck-app.html`);
  await page.waitForSelector('.list-row');

  // ---- service worker ----
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload(); // first load can finish before the worker takes control
  await page.waitForSelector('.list-row');
  check('service worker: registered and in control of the page', await page.evaluate(() => !!navigator.serviceWorker.controller));
  const cached = await page.evaluate(async () => (await (await caches.open('fd-v1')).keys()).map((r) => new URL(r.url).pathname));
  for (const need of ['/deck-app.html', '/js/deck.js', '/js/games.js', '/js/site.js', '/fonts/karla.woff2', '/fonts/alfa-slab-one.woff2', '/icon-192.png', '/icon-512.png', '/manifest.json']) {
    check(`cache holds ${need}`, cached.includes(need));
  }
  check('cache holds only this site (nothing from Google)', await page.evaluate(async () => (await (await caches.open('fd-v1')).keys()).every((r) => new URL(r.url).origin === location.origin)));
  check('sign-up API requests are not touched by the worker', (await page.evaluate(() => fetch('/api/subscribe', { method: 'POST' }).then((r) => r.status))) === 404);

  // ---- offline ----
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.list-row', { timeout: 15000 });
  check('offline: the deck opens with all 27 games', (await page.locator('.list-row').count()) === 27);
  await page.locator('.list-row', { hasText: 'Charades' }).click();
  check('offline: a game card opens', (await page.locator('#detailStage .title').innerText()) === 'Charades');
  check('offline: fonts still load', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Karla') && document.fonts.check('16px "Alfa Slab One"'); }));
  await page.goto(`${site.base}/index.html`);
  check('offline: the homepage opens', (await page.locator('h1').innerText()).includes('One deck'));
  await page.goto(`${site.base}/privacy.html`);
  check('offline: the privacy page opens', (await page.locator('h1').innerText()).includes('Privacy'));
  await page.goto(`${site.base}/deck-app.html#g=oxford-vs-cambridge`);
  check('offline: a shared game link opens that game', (await page.locator('#detailStage .title').innerText()) === 'Oxford vs Cambridge');
  check('offline: no script errors', errors.length === 0, errors.join('; '));
  if (shots) await page.screenshot({ path: `${shots}/pwa-offline-${engine}.png` });
  await ctx.setOffline(false);

  // ---- updates arrive: network first ----
  const original = await (await fetch(`${site.base}/deck-app.html`)).text();
  site.override('/deck-app.html', original.replace('<title>', '<title>UPDATED '));
  await page.goto(`${site.base}/deck-app.html`);
  await page.waitForSelector('.list-row');
  check('online: a new version is shown straight away, not the saved one', (await page.title()).startsWith('UPDATED'), await page.title());
  site.clearOverrides();
  await ctx.setOffline(true);
  await page.goto(`${site.base}/deck-app.html`);
  check('offline after that: the latest version is what was saved', (await page.title()).startsWith('UPDATED'), await page.title());
  await ctx.setOffline(false);
  await page.goto(`${site.base}/deck-app.html`);
  check('back online: the normal version returns', !(await page.title()).startsWith('UPDATED'));

} finally {
  await browser.close();
}

// ---- Chrome's installability check and standalone look ----
// Needs a normal (non-incognito) profile, which is what a real visitor has.
if (engine === 'chromium') {
  const dir = mkdtempSync(join(tmpdir(), 'fd-pwa-'));
  const persistent = await chromium.launchPersistentContext(dir, { ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), ...devices['iPhone 14'] });
  try {
    const p = persistent.pages()[0] ?? (await persistent.newPage());
    await persistent.addInitScript(() => localStorage.setItem('fd-consent', JSON.stringify({ choice: 'denied', at: Date.now() })));
    await p.goto(`${site.base}/deck-app.html`);
    await p.waitForSelector('.list-row');
    await p.evaluate(() => navigator.serviceWorker.ready);
    const cdp = await persistent.newCDPSession(p);
    const manifest = await cdp.send('Page.getAppManifest');
    check('Chrome: manifest parses with no errors', (manifest.errors ?? []).length === 0, JSON.stringify(manifest.errors));
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    check('Chrome: installable (no installability errors)', installabilityErrors.length === 0, JSON.stringify(installabilityErrors));
    // (Chrome can't emulate display-mode: standalone, so this opens the start URL the way an installed app would.)
    await p.goto(new URL(manifest.data ? JSON.parse(manifest.data).start_url : '/deck-app.html', site.base).href);
    await p.waitForSelector('.list-row');
    check("the manifest's start URL opens the deck", (await p.locator('.list-row').count()) === 27);
    if (shots) await p.screenshot({ path: `${shots}/pwa-start-url.png` });
  } finally {
    await persistent.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
site.close();
process.exit(done(engine) ? 0 : 1);
