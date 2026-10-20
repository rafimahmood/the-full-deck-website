// Cookie banner and Google Analytics consent, in a real browser.
//
//   npm run test:e2e:consent                 (WebKit)
//   npm run test:e2e:consent -- chromium
//
// Google's tag is replaced by an empty stub, so this never sends anything to the real Analytics
// property. What is checked is whether the browser ASKS for Google's tag, and when.
import { engineFromArgs, launch, reporter, startServer } from './lib.mjs';

const engine = engineFromArgs();
const site = await startServer();
const browser = await launch(engine);
const { check, done } = reporter();
const GA = 'G-BNTY8C42YG';

async function newVisitor(options = {}) {
  const ctx = await browser.newContext(options);
  const googleRequests = [];
  ctx.on('request', (r) => { if (/google|doubleclick|gstatic\.com\/.*gtag/i.test(new URL(r.url()).hostname)) googleRequests.push(r.url()); });
  await ctx.route(/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* test stub: not the real gtag.js */' }));
  const page = await ctx.newPage();
  return { ctx, page, googleRequests };
}
const banner = (page) => page.locator('#fd-consent, .fd-consent').first();
const stored = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('fd-consent') || 'null'); } catch { return null; } });
const layer = (page) => page.evaluate(() => (window.dataLayer || []).map((e) => Array.from(e)));
const tagRequests = (v) => v.googleRequests.filter((u) => u.includes('googletagmanager.com/gtag/js'));

try {
  // ---- before any choice, on every page ----
  for (const path of ['index.html', 'deck-app.html', 'privacy.html']) {
    const v = await newVisitor();
    await v.page.goto(`${site.base}/${path}`);
    await banner(v.page).waitFor({ state: 'visible' });
    await v.page.waitForTimeout(500);
    const l = await layer(v.page);
    check(`${path}: banner is shown on a first visit`, true);
    check(`${path}: nothing requested from Google before a choice`, v.googleRequests.length === 0, v.googleRequests.join(', '));
    check(`${path}: consent declared as all denied`, JSON.stringify(l[0]) === JSON.stringify(['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', functionality_storage: 'denied', personalization_storage: 'denied', security_storage: 'denied' }]), JSON.stringify(l[0]));
    check(`${path}: no gtag script in the page`, (await v.page.locator('script[src*="googletagmanager"]').count()) === 0);
    check(`${path}: no analytics cookies`, (await v.ctx.cookies()).every((c) => !/^_ga|^_gid/.test(c.name)));
    await v.ctx.close();
  }

  // ---- banner basics ----
  {
    const v = await newVisitor({ viewport: { width: 390, height: 844 } });
    await v.page.goto(`${site.base}/index.html`);
    await banner(v.page).waitFor({ state: 'visible' });
    const accept = v.page.getByRole('button', { name: 'Accept' });
    const reject = v.page.getByRole('button', { name: 'Reject' });
    const [a, r] = [await accept.boundingBox(), await reject.boundingBox()];
    check('banner: Accept and Reject are the same size', Math.abs(a.width - r.width) < 1 && Math.abs(a.height - r.height) < 1, `${a.width}x${a.height} vs ${r.width}x${r.height}`);
    const style = (loc) => loc.evaluate((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.color, c.fontSize, c.fontWeight, c.borderTopWidth].join('|'); });
    check('banner: Accept and Reject look identical', (await style(accept)) === (await style(reject)));
    check('banner: dialog is labelled for screen readers', (await banner(v.page).getAttribute('role')) === 'dialog' && !!(await banner(v.page).getAttribute('aria-labelledby')));
    check('banner: fits the screen with no horizontal scroll', await v.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await v.ctx.close();
  }

  // ---- Reject ----
  {
    const v = await newVisitor();
    await v.ctx.addCookies([{ name: '_ga', value: 'GA1.1.1.1', url: site.base }, { name: '_ga_BNTY8C42YG', value: 'GS1.1.1.1', url: site.base }, { name: 'keep', value: '1', url: site.base }]);
    await v.page.goto(`${site.base}/index.html`);
    await banner(v.page).waitFor({ state: 'visible' });
    await v.page.getByRole('button', { name: 'Reject' }).click();
    await banner(v.page).waitFor({ state: 'hidden' });
    await v.page.waitForTimeout(400);
    check('Reject: banner closes', await banner(v.page).isHidden());
    check('Reject: choice remembered as denied', (await stored(v.page))?.choice === 'denied');
    check('Reject: Google never asked for', v.googleRequests.length === 0, v.googleRequests.join(', '));
    const names = (await v.ctx.cookies()).map((c) => c.name);
    check('Reject: existing Analytics cookies removed, others kept', !names.includes('_ga') && !names.includes('_ga_BNTY8C42YG') && names.includes('keep'), names.join(','));
    check('Reject: collection switched off', await v.page.evaluate((id) => window[`ga-disable-${id}`] === true, GA));
    // remembered across pages and reloads
    await v.page.goto(`${site.base}/deck-app.html`);
    await v.page.waitForSelector('.list-row');
    await v.page.reload();
    await v.page.waitForSelector('.list-row');
    check('Reject: banner stays away on other pages and reloads', await banner(v.page).isHidden() && v.googleRequests.length === 0);

    // ---- change of mind via the footer link ----
    await v.page.getByRole('button', { name: 'Cookie settings' }).click();
    await banner(v.page).waitFor({ state: 'visible' });
    check('Cookie settings: reopens the banner and shows the current choice', /rejected/i.test(await v.page.locator('#fd-consent-current').innerText()));
    check('Cookie settings: focus moves to the banner', await v.page.evaluate(() => document.activeElement?.classList.contains('fd-consent')));
    await v.page.getByRole('button', { name: 'Accept' }).click();
    await v.page.waitForTimeout(600);
    check('Accept: banner closes and focus returns to the link', await banner(v.page).isHidden() && (await v.page.evaluate(() => document.activeElement?.textContent)) === 'Cookie settings');
    check('Accept: choice remembered as granted', (await stored(v.page))?.choice === 'granted');
    check('Accept: Google\'s tag requested exactly once, for the right ID', tagRequests(v).length === 1 && tagRequests(v)[0].endsWith(`id=${GA}`), tagRequests(v).join(', '));
    const l = await layer(v.page);
    const flat = l.map((e) => e.slice(0, 2).join(' '));
    check('Accept: consent updated to granted for analytics only, before the config', flat.indexOf('consent update') > -1 && flat.indexOf('consent update') < flat.indexOf(`config ${GA}`), flat.join(' | '));
    check('Accept: only analytics_storage is granted', JSON.stringify(l.find((e) => e[0] === 'consent' && e[1] === 'update')?.[2]) === JSON.stringify({ analytics_storage: 'granted' }));
    check('Accept: advertising features stay off', JSON.stringify(l.find((e) => e[0] === 'config')?.[2]) === JSON.stringify({ allow_google_signals: false, allow_ad_personalization_signals: false }));

    // ---- remembered Accept: the tag loads on the next page without asking again ----
    await v.page.goto(`${site.base}/privacy.html`);
    await v.page.waitForTimeout(600);
    check('Remembered Accept: no banner, tag loads on the next page', await banner(v.page).isHidden() && tagRequests(v).length === 2);

    // ---- withdraw ----
    await v.ctx.addCookies([{ name: '_ga', value: 'GA1.1.2.2', url: site.base }]);
    await v.page.getByRole('link', { name: /privacy/i }).first().isVisible().catch(() => {});
    await v.page.locator('#cookies ~ p button[data-cookie-settings]').click();
    await banner(v.page).waitFor({ state: 'visible' });
    await v.page.getByRole('button', { name: 'Reject' }).click();
    await v.page.waitForTimeout(400);
    check('Withdraw: stored as denied, cookies removed, collection off', (await stored(v.page))?.choice === 'denied' && !(await v.ctx.cookies()).some((c) => c.name === '_ga') && await v.page.evaluate((id) => window[`ga-disable-${id}`] === true, GA));
    check('Withdraw: consent updated to denied', JSON.stringify((await layer(v.page)).at(-1)) === JSON.stringify(['consent', 'update', { analytics_storage: 'denied' }]));
    await v.page.goto(`${site.base}/index.html`);
    await v.page.waitForTimeout(500);
    check('Withdraw: next visit loads no tag', tagRequests(v).length === 2);
    await v.ctx.close();
  }

  // ---- Accept straight from the banner ----
  {
    const v = await newVisitor();
    await v.page.goto(`${site.base}/deck-app.html`);
    await banner(v.page).waitFor({ state: 'visible' });
    check('Accept (first visit): nothing from Google until the click', v.googleRequests.length === 0);
    await v.page.getByRole('button', { name: 'Accept' }).click();
    await v.page.waitForTimeout(600);
    check('Accept (first visit): tag requested after the click', tagRequests(v).length === 1);
    await v.ctx.close();
  }

  // ---- keyboard ----
  {
    const v = await newVisitor();
    await v.page.goto(`${site.base}/privacy.html`);
    await banner(v.page).waitFor({ state: 'visible' });
    // Safari doesn't Tab onto buttons unless a system setting is on, so there the button is focused directly.
    if (engine === 'webkit') await v.page.getByRole('button', { name: 'Reject' }).focus();
    else for (let i = 0; i < 40 && !(await v.page.evaluate(() => document.activeElement?.textContent === 'Reject')); i++) await v.page.keyboard.press('Tab');
    await v.page.keyboard.press('Enter');
    await v.page.waitForTimeout(300);
    check('keyboard: Reject can be reached and Enter activates it', (await stored(v.page))?.choice === 'denied' && (await banner(v.page).isHidden()));
    await v.ctx.close();
  }

  // ---- an old choice is asked again ----
  {
    const v = await newVisitor();
    await v.ctx.addInitScript(() => localStorage.setItem('fd-consent', JSON.stringify({ choice: 'granted', at: Date.now() - 400 * 24 * 3600 * 1000 })));
    await v.page.goto(`${site.base}/index.html`);
    await banner(v.page).waitFor({ state: 'visible' });
    await v.page.waitForTimeout(400);
    check('a choice over a year old is asked again, and the tag does not load', v.googleRequests.length === 0);
    await v.ctx.close();
  }

  // ---- storage blocked ----
  {
    const v = await newVisitor();
    await v.ctx.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }));
    await v.page.goto(`${site.base}/index.html`);
    await banner(v.page).waitFor({ state: 'visible' });
    await v.page.getByRole('button', { name: 'Reject' }).click();
    check('storage blocked: banner still works and loads nothing', await banner(v.page).isHidden() && v.googleRequests.length === 0);
    await v.ctx.close();
  }
} finally {
  await browser.close();
  site.close();
}
process.exit(done(engine) ? 0 : 1);
