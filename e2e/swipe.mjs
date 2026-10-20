// Swipe test for the full-screen Randomize card on an iPhone 14.
//
//   npx playwright install webkit chromium     (once)
//   npm run test:e2e                           (WebKit, the engine iPhone Safari uses)
//   npm run test:e2e -- chromium               (real touch input through the DevTools protocol)
//   PW_CHANNEL=chrome npm run test:e2e -- chromium   (use the Chrome you already have installed)
//
// Chromium drives genuine touch events, so it exercises the browser's own touch-action and
// scroll-container rules, which is where the iPhone bug was. Playwright's WebKit has no
// touch-drag API, so there the swipe is a sequence of touch pointer events fired in the page,
// and the test also checks the computed touch-action/overflow that stop Safari taking the gesture.
import { devices } from 'playwright';
import { engineFromArgs, launch, reporter, startServer } from './lib.mjs';

const engine = engineFromArgs();
const site = await startServer();
const url = `${site.base}/deck-app.html`;
const browser = await launch(engine);
const ctx = await browser.newContext({ ...devices['iPhone 14'] });
// A choice is already made, so the cookie banner doesn't sit over the controls being tested.
await ctx.addInitScript(() => localStorage.setItem('fd-consent', JSON.stringify({ choice: 'denied', at: Date.now() })));
const page = await ctx.newPage();
const cdp = engine === 'chromium' ? await ctx.newCDPSession(page) : null;

const { check, done } = reporter();

async function swipe(x, y, dx, dy, steps = 10) {
  if (cdp) {
    const at = (i) => [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i) }); await page.waitForTimeout(12); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.evaluate(async ([x, y, dx, dy, steps]) => {
      const el = document.elementFromPoint(x, y);
      const fire = (type, i) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x + (dx * i) / steps, clientY: y + (dy * i) / steps }));
      fire('pointerdown', 0);
      for (let i = 1; i <= steps; i++) { fire('pointermove', i); await new Promise((r) => setTimeout(r, 12)); }
      fire('pointerup', steps);
    }, [x, y, dx, dy, steps]);
  }
  await page.waitForTimeout(700);
}

const title = () => page.locator('#fsStage .title').innerText();
const cardBox = () => page.locator('#fsStage .card').boundingBox();

// Step through the deck until a card of the wanted kind is showing.
async function goTo(kind) {
  for (let i = 0; i < 60; i++) {
    const ok = await page.evaluate((k) => {
      const card = document.querySelector('#fsStage .card');
      if (!card) return false;
      const rules = card.querySelector('.rules');
      const secret = !!card.querySelector('.spoiler-block');
      const long = rules.scrollHeight > rules.clientHeight + 4;
      return k === 'normal' ? !secret && !long : k === 'secret' ? secret : k === 'long' ? long : card.querySelector('.title').textContent === k;
    }, kind);
    if (ok) { await page.waitForTimeout(450); return true; }
    await page.tap('#fsNext');
    await page.waitForTimeout(80);
  }
  return false;
}

async function swipeBothWays(label, kind, prepare) {
  if (!(await goTo(kind))) return check(label, false, 'no such card in the deck');
  if (prepare) await prepare();
  const before = await title();
  const b = await cardBox();
  const y = b.y + b.height * 0.62; // over the rules text, where the scroll area is
  await swipe(b.x + b.width / 2 + 60, y, -150, 6);
  const next = await title();
  check(`${label}: swipe left shows the next card`, next !== before);
  await swipe(b.x + b.width / 2 - 60, y, 150, -5);
  check(`${label}: swipe right goes back`, next !== before && (await title()) === before);
}

try {
  await page.goto(url);
  await page.waitForSelector('.list-row');
  await page.tap('.mode-btn[data-mode="random"]');
  await page.tap('#drawBtn');
  await page.waitForSelector('#fs:not([hidden])');
  await page.waitForTimeout(500);

  // The cause of the iPhone bug: anything inside the card that lets the browser pan sideways.
  const styles = await page.evaluate(() => {
    const els = [...document.querySelectorAll('#fsStage .card, #fsStage .card *')];
    const rules = document.querySelector('#fsStage .rules');
    return { bad: els.filter((e) => getComputedStyle(e).touchAction !== 'pan-y').map((e) => e.className || e.tagName), overflowX: getComputedStyle(rules).overflowX };
  });
  check('every element in the card is touch-action: pan-y', styles.bad.length === 0, styles.bad.join(', '));
  check('rules area does not scroll sideways', styles.overflowX === 'hidden', styles.overflowX);

  await swipeBothWays('normal card', 'normal');
  await swipeBothWays('long card (Oxford vs Cambridge)', 'Oxford vs Cambridge');
  await swipeBothWays('secret card before reveal', 'secret');
  await swipeBothWays('secret card after reveal', 'secret', async () => { await page.tap('#fsStage .reveal-prompt'); await page.waitForTimeout(200); });

  await goTo('normal');
  let t = await title(); let b = await cardBox();
  await swipe(b.x + b.width / 2, b.y + b.height * 0.6, -30, 8);
  check('a small drag does not change the card', (await title()) === t);

  await goTo('normal');
  t = await title(); b = await cardBox();
  await swipe(b.x + b.width / 2 + 40, b.y + b.height * 0.5, -90, 140);
  check('a mostly-vertical diagonal drag does not change the card', (await title()) === t);

  if (cdp) { // real touch scrolling is only available through the DevTools protocol
    await goTo('Oxford vs Cambridge');
    t = await title(); b = await cardBox();
    await swipe(b.x + b.width / 2, b.y + b.height * 0.75, 4, -160);
    check('vertical drag still scrolls the long rules', (await page.evaluate(() => document.querySelector('#fsStage .rules').scrollTop)) > 20);
    check('vertical drag does not change the card', (await title()) === t);
  }
} finally {
  await browser.close();
  site.close();
}

process.exit(done(engine) ? 0 : 1);
