import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const text = (p: string) => readFileSync(new URL(p, root), 'utf8');
const pages = ['index.html', 'deck-app.html', 'privacy.html'];

/** Width and height from a PNG's header. */
const pngSize = (p: string) => {
  const b = readFileSync(new URL(p, root));
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

const manifest = JSON.parse(text('manifest.json')) as {
  name: string; short_name: string; start_url: string; display: string; background_color: string; theme_color: string;
  scope: string; icons: Array<{ src: string; sizes: string; type: string }>;
};

describe('manifest.json', () => {
  it('has the agreed identity and colours', () => {
    expect(manifest.name).toBe('The Full Deck');
    expect(manifest.short_name).toBe('Full Deck');
    expect(manifest.start_url).toBe('/deck-app.html');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#F6F1E7');
    expect(manifest.theme_color).toBe('#B5482A');
  });
  it('start_url is inside the scope', () => expect(manifest.start_url.startsWith(manifest.scope)).toBe(true));
  it('lists 192 and 512 icons that exist and are really that size', () => {
    expect(manifest.icons.map((i) => i.sizes).sort()).toEqual(['192x192', '512x512']);
    for (const icon of manifest.icons) {
      const path = icon.src.replace(/^\//, '');
      expect(existsSync(new URL(path, root)), icon.src).toBe(true);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(path)).toEqual({ width: w, height: h });
      expect(icon.type).toBe('image/png');
    }
  });
  it('the iOS icon is 180x180', () => expect(pngSize('apple-touch-icon.png')).toEqual({ width: 180, height: 180 }));
});

describe.each(pages)('%s head', (page) => {
  const html = text(page);
  it('links the manifest and the icons', () => {
    expect(html).toContain('<link rel="manifest" href="manifest.json">');
    expect(html).toContain('<link rel="apple-touch-icon" href="apple-touch-icon.png">');
    expect(html).toContain('<link rel="icon" href="favicon.svg" type="image/svg+xml">');
  });
  it('has the theme colour and the iOS home-screen tags', () => {
    expect(html).toContain('<meta name="theme-color" content="#B5482A">');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Full Deck">');
  });
  it('runs the site script (banner and service worker)', () => expect(html).toContain('<script type="module" src="js/site.js"></script>'));
  it('has a Cookie settings link', () => expect(html).toContain('data-cookie-settings'));
  it('does not load Google or call gtag itself, so nothing can fire before consent', () => {
    expect(html).not.toMatch(/googletagmanager|google-analytics|gtag\(/i);
  });
});

describe('service worker', () => {
  const sw = text('sw.js');
  const precache = [...(/const PRECACHE = \[([\s\S]*?)\];/.exec(sw)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] as string);

  it('precaches only files that exist', () => {
    expect(precache.length).toBeGreaterThan(10);
    for (const url of precache) {
      if (url === '/') continue;
      expect(existsSync(new URL(url.slice(1), root)), url).toBe(true);
    }
  });
  it('precaches the app page, every script and every font, and the icons', () => {
    for (const must of ['/', '/deck-app.html', '/index.html', '/privacy.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']) {
      expect(precache, must).toContain(must);
    }
    for (const f of readdirSync(new URL('js/', root)).filter((n) => n.endsWith('.js'))) expect(precache, f).toContain(`/js/${f}`);
    for (const f of readdirSync(new URL('fonts/', root))) expect(precache, f).toContain(`/fonts/${f}`);
  });
  it('uses the network first for pages and scripts so updates arrive', () => {
    expect(sw).toMatch(/\\\.\(woff2\|png\|svg\)\$/); // only fonts and images are cache-first
    expect(sw).toContain('networkFirst(request)');
  });
  it('leaves the sign-up API, other sites and non-GET requests alone', () => {
    expect(sw).toContain("request.method !== 'GET'");
    expect(sw).toContain('url.origin !== self.location.origin');
    expect(sw).toContain("url.pathname.startsWith('/api/')");
  });
});

describe('cookie banner', () => {
  const banner = text('src/banner.ts');
  it('gives Accept and Reject the same styling', () => {
    expect(banner).toContain('data-choice="denied">Reject</button><button type="button" data-choice="granted">Accept</button>');
    const css = /const CSS = `([\s\S]*?)`;/.exec(banner)?.[1] ?? '';
    expect(css).toContain('.fd-consent-actions button{');
    expect(css).not.toContain('data-choice'); // no rule that styles one button differently
  });
  it('is the only place the Google tag is added, and only through grant()', () => {
    expect(banner).not.toMatch(/googletagmanager/);
    expect(text('src/consent.ts').match(/this\.env\.loadScript\(/g)).toHaveLength(1);
  });
});

describe('deck-app.html layout', () => {
  it('centres the content inside <main> the way the body used to', () => {
    const html = text('deck-app.html');
    expect(html).toMatch(/main\{[^}]*display:flex[^}]*flex-direction:column[^}]*align-items:center/);
  });
});
