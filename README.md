# The Full Deck — Website

**Live site:** https://thefulldeck.netlify.app

The website for **The Full Deck**, a party card game: a deck of party games for every table.

## Pages

- `index.html`: landing page introducing the deck, with the Mailchimp sign-up form
- `deck-app.html`: the deck itself, where you browse the cards and their rules, filter by player count and equipment, randomize, and share a link to any game (`deck-app.html#g=charades`)
- `privacy.html`: terms and privacy

The pages are plain static HTML and CSS. The deck's game data and logic are TypeScript in `src/`, compiled to `js/` and committed, so Netlify needs no build step. The one dynamic piece is the sign-up form, which talks to a small Netlify Function (see below).

## The deck app

- `src/games.ts`: all 27 games (rules text approved game by game, see `RULES_REVIEW.md`)
- `src/deck.ts`: player-count parsing (`Any`, `2`, `4+`, `6+ (even)`), filters, the no-repeat random draw, share links
- `js/`: compiled output that `deck-app.html` loads. After changing anything in `src/`, run `npm run build` and commit `js/`. CI fails if `js/` is out of date.
- `npm run serve` serves the site on http://localhost:8080. Open the app that way, not by double-clicking the file, because browsers block ES modules on `file://`.

## Fonts, icons and previews

- Fonts (Alfa Slab One, Karla, Space Mono; Latin subset) are self-hosted in `fonts/` and declared inline in each page, so nothing blocks rendering on a third-party stylesheet.
- `favicon.svg`, `favicon-32.png`, `favicon-192.png` and `apple-touch-icon.png` are linked from every page.
- `og-image.png` (1200x630) is the Open Graph / Twitter card image for `index.html` and `deck-app.html`. Browsers don't send the `#...` part of a URL, so a shared game link (`deck-app.html#g=charades`) previews as the deck page, not as that one game.

## Analytics, cookies and the installable app

- **Google Analytics (GA4, `G-BNTY8C42YG`)** is loaded only after a visitor presses **Accept** on the cookie banner. Consent Mode v2 is declared with everything denied, and the Google tag is not added to the page, so nothing is sent to Google, until then. Reject (or withdrawing later via the **Cookie settings** link in every footer) switches it off and removes the `_ga` cookies. The choice is kept in `localStorage` for a year. The logic is `src/consent.ts` (unit-tested) and the banner is `src/banner.ts`; both run from `src/site.ts` on every page. `privacy.html` explains it to visitors.
- **Installable app:** `manifest.json` (start page `/deck-app.html`), the icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) and the iOS tags in each page's head. `sw.js` is the service worker: pages and scripts are network-first (a deploy shows up straight away), fonts and icons come from the cache, and the deck opens offline. If you add a file the pages load, add it to `PRECACHE` in `sw.js` (a test fails if the list is out of step).
- Browser tests: `npm run test:e2e:consent` and `npm run test:e2e:pwa` (add `-- chromium` for Chrome). `E2E_BASE=https://thefulldeck.netlify.app npm run test:e2e:consent` runs the consent test against the live site; Google's tag is stubbed in the test, so no test visits reach Analytics.

## Sign-up flow

The "Notify me" form on `index.html` adds people to a Mailchimp audience.

```
Browser (index.html)  ──POST /api/subscribe {email, company}──►  netlify/functions/subscribe.ts  ──►  Mailchimp Marketing API
        ▲                                                                   │
        └──────────── { ok, alreadySubscribed, message } ◄─────────────────┘
```

1. **The page** shows real states: *Sending…* (button disabled), *You're on the list* (success), or a clear error message with the form kept so people can retry. It also validates the address before sending.
2. **The function** (`netlify/functions/subscribe.ts`, TypeScript) validates the email again on the server, then calls `POST /lists/{audience}/members` with status `subscribed`.
   - Someone who is already on the audience gets a friendly *"You're already on the list"* success.
   - A hidden **honeypot** field (`company`) catches bots: if it's filled in, the function reports success but never contacts Mailchimp.
   - Only POST requests from this site are accepted, bodies are size-limited, and Mailchimp failures are translated into short messages (invalid email, busy, try later). API keys and raw Mailchimp responses are never sent to the browser.
3. **Mailchimp** receives the subscriber. If an address previously unsubscribed, Mailchimp does not allow it to be re-added through the API, and the visitor is told to get in touch.

### Configuration (secrets are never committed)

The function reads three environment variables. They are already set in Netlify (**Site configuration → Environment variables**, Functions scope):

| Variable | What it is |
| --- | --- |
| `MAILCHIMP_API_KEY` | Marketing API key (Account → Extras → API keys) |
| `MAILCHIMP_AUDIENCE_ID` | Audience ID (Audience → Settings → Audience name and defaults) |
| `MAILCHIMP_SERVER_PREFIX` | Data centre prefix, the part after the dash in the key, e.g. `us21` |

`.env` is git-ignored; `.env.example` lists the names only. CI also fails if something that looks like a Mailchimp key is committed. If a key is ever exposed, rotate it in Mailchimp and update the Netlify variable.

### Run it locally

```bash
npm install
cp .env.example .env          # fill in your values; never commit this file
npx netlify-cli dev           # site and function on http://localhost:8888
npm test                      # function tests (Mailchimp is mocked)
npm run typecheck
```

### Tests and CI

`tests/deck.test.ts` covers player-count parsing, the player and equipment filters, the random draw never repeating until the deck is used up, share links and a data check on every game. `tests/subscribe.test.ts` covers email validation, the Mailchimp request, the "already subscribed" case, the honeypot, origin and method checks, missing configuration, and every Mailchimp error mapping, with a mocked `fetch`. `e2e/swipe.mjs` is a Playwright check of swiping on the phone full-screen card (iPhone 14: normal, long and secret cards, plus scrolling and small or diagonal drags). It needs browsers, so CI doesn't run it. Run `npx playwright install webkit chromium` once, then `npm run test:e2e` (WebKit) or `npm run test:e2e -- chromium` (real touch input). GitHub Actions (`.github/workflows/ci.yml`) runs a secret scan, the typecheck and the tests on every push.

## Hosting

The site is hosted on [Netlify](https://www.netlify.com/) and deploys automatically on every push to `main`. GitHub Pages is not used.
