// The cookie banner and the "Cookie settings" links. consent.ts holds the rules.
import { Analytics, gaCookieNames, readChoice, saveChoice } from './consent.js';
const CSS = `
.fd-consent{position:fixed;left:12px;right:12px;bottom:12px;max-width:560px;margin:0 auto;z-index:60;
  background:var(--paper,#EFE7D6);color:var(--ink,#2B2118);border:1.5px solid var(--border-soft,rgba(43,33,24,.25));
  border-radius:16px;padding:16px 18px;box-shadow:0 18px 40px -16px rgba(0,0,0,.45);
  font-family:'Karla','Karla Fallback',sans-serif;font-size:14.5px;line-height:1.5}
.fd-consent[hidden]{display:none}
.fd-consent:focus{outline:none}
.fd-consent-title{font-family:'Alfa Slab One','Alfa Slab Fallback',serif;font-weight:400;font-size:17px;margin:0 0 6px}
.fd-consent p{margin:0 0 12px}
.fd-consent a{color:inherit;text-decoration:underline}
.fd-consent-current{font-family:'Space Mono','Space Mono Fallback',monospace;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
.fd-consent-actions{display:flex;gap:10px}
.fd-consent-actions button{flex:1;font-family:'Space Mono','Space Mono Fallback',monospace;font-size:12.5px;letter-spacing:.04em;text-transform:uppercase;
  padding:13px 12px;border-radius:100px;border:1.5px solid var(--ink,#2B2118);background:var(--ink,#2B2118);color:var(--cream,#F6F1E7);cursor:pointer}
.fd-consent-actions button:focus-visible,.fd-cookie-link:focus-visible{outline:2px solid var(--brand,#B5482A);outline-offset:3px}
.fd-cookie-link{background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer;letter-spacing:inherit;text-transform:inherit}
`;
function browserEnv() {
    const w = window;
    const dataLayer = (w.dataLayer ??= []);
    // Google's tag reads the `arguments` object itself, so a rest-parameter array would not work here.
    function gtag(..._args) {
        // eslint-disable-next-line prefer-rest-params
        dataLayer.push(arguments);
    }
    w.gtag = gtag;
    return {
        gtag,
        loadScript(src) {
            const s = document.createElement('script');
            s.async = true;
            s.src = src;
            document.head.appendChild(s);
        },
        setDisabled(id, disabled) {
            w[`ga-disable-${id}`] = disabled;
        },
        clearCookies() {
            const names = gaCookieNames(document.cookie.split(';').map((c) => (c.split('=')[0] ?? '').trim()).filter(Boolean));
            const labels = location.hostname.split('.');
            // Analytics sets its cookies on the host or a parent domain, so expire both.
            const domains = ['', ...labels.slice(0, -1).flatMap((_, i) => [labels.slice(i).join('.'), `.${labels.slice(i).join('.')}`])];
            for (const name of names) {
                for (const domain of domains) {
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`;
                }
            }
        },
    };
}
function storage() {
    try {
        return window.localStorage;
    }
    catch {
        return null;
    }
}
export function initBanner() {
    const analytics = new Analytics(browserEnv());
    const store = storage();
    const choice = readChoice(store);
    if (choice === 'granted')
        analytics.grant();
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const banner = document.createElement('div');
    banner.className = 'fd-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'fd-consent-title');
    banner.setAttribute('aria-describedby', 'fd-consent-text');
    banner.tabIndex = -1;
    banner.hidden = true;
    banner.innerHTML =
        `<p class="fd-consent-title" id="fd-consent-title">Cookies</p>` +
            `<p id="fd-consent-text">We'd like to use Google Analytics cookies to count visits and see which games get played. They only switch on if you say yes. <a href="privacy.html#cookies">Privacy details</a></p>` +
            `<p class="fd-consent-current" id="fd-consent-current" hidden></p>` +
            `<div class="fd-consent-actions"><button type="button" data-choice="denied">Reject</button><button type="button" data-choice="granted">Accept</button></div>`;
    document.body.appendChild(banner);
    const current = banner.querySelector('#fd-consent-current');
    let opener = null;
    function open(from) {
        opener = from;
        const now = readChoice(store);
        current.hidden = now === null;
        current.textContent = now === 'granted' ? 'Your choice: analytics accepted' : now === 'denied' ? 'Your choice: analytics rejected' : '';
        banner.hidden = false;
        if (from)
            banner.focus(); // reopened on purpose, so move focus to it. On first load, don't take it.
    }
    function choose(next) {
        saveChoice(store, next);
        if (next === 'granted')
            analytics.grant();
        else
            analytics.revoke();
        banner.hidden = true;
        opener?.focus();
        opener = null;
    }
    banner.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-choice]');
        if (button)
            choose(button.dataset.choice);
    });
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-cookie-settings]');
        if (!link)
            return;
        e.preventDefault();
        open(link);
    });
    if (choice === null)
        open(null);
}
