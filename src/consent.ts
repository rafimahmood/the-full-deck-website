// Cookie consent and Google Analytics (GA4) loading.
//
// UK PECR / GDPR: nothing analytics-related is loaded or stored until the visitor accepts.
// Consent Mode v2 is declared with everything denied up front. gtag.js itself is only added to
// the page after Accept (Google calls this "basic" consent mode), so before a choice is made
// nothing is sent to Google, not even cookieless pings.
//
// No DOM code in this file, so it can be unit-tested. banner.ts wires it to the page.

export const GA_ID = 'G-BNTY8C42YG';
export const STORAGE_KEY = 'fd-consent';
/** The choice is asked again after a year. */
export const CHOICE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type Choice = 'granted' | 'denied';

/** Consent Mode v2 default: everything denied. */
export const ALL_DENIED = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'denied',
  personalization_storage: 'denied',
  security_storage: 'denied',
} as const;

/** Visit measurement only: no advertising features or audiences. */
export const GA_CONFIG = {
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;

export function gtagScriptUrl(id: string = GA_ID): string {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
}

/** The remembered choice, or null if there is none, it is unreadable, or it is over a year old. */
export function readChoice(storage: Pick<Storage, 'getItem'> | null, now: number = Date.now()): Choice | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { choice?: unknown; at?: unknown };
    if (saved.choice !== 'granted' && saved.choice !== 'denied') return null;
    if (typeof saved.at !== 'number' || now - saved.at > CHOICE_MAX_AGE_MS) return null;
    return saved.choice;
  } catch {
    return null;
  }
}

/** Remembers the choice. Returns false if storage isn't available (private mode, blocked). */
export function saveChoice(storage: Pick<Storage, 'setItem'> | null, choice: Choice, now: number = Date.now()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: now }));
    return true;
  } catch {
    return false;
  }
}

/** Which of these cookie names belong to Google Analytics. */
export function gaCookieNames(names: readonly string[], id: string = GA_ID): string[] {
  const property = `_ga_${id.replace(/^G-/, '')}`;
  return names.filter((n) => n === '_ga' || n === property || n === '_gid' || n.startsWith('_gat'));
}

export interface AnalyticsEnv {
  /** window.gtag: pushes its arguments onto dataLayer. */
  gtag(...args: unknown[]): void;
  loadScript(src: string): void;
  /** Sets window['ga-disable-<id>'], which makes an already-loaded gtag.js do nothing. */
  setDisabled(id: string, disabled: boolean): void;
  clearCookies(): void;
}

export class Analytics {
  private started = false;

  constructor(
    private readonly env: AnalyticsEnv,
    private readonly id: string = GA_ID,
  ) {
    env.gtag('consent', 'default', { ...ALL_DENIED });
  }

  /** gtag.js has been added to the page. */
  get loaded(): boolean {
    return this.started;
  }

  /** The visitor accepted: allow analytics storage and, the first time, load Google's tag. */
  grant(): void {
    this.env.setDisabled(this.id, false);
    this.env.gtag('consent', 'update', { analytics_storage: 'granted' });
    if (this.started) return;
    this.started = true;
    this.env.gtag('js', new Date());
    this.env.gtag('config', this.id, { ...GA_CONFIG });
    this.env.loadScript(gtagScriptUrl(this.id));
  }

  /** The visitor rejected or withdrew consent: stop collection and remove Analytics cookies. */
  revoke(): void {
    this.env.gtag('consent', 'update', { analytics_storage: 'denied' });
    this.env.setDisabled(this.id, true);
    this.env.clearCookies();
  }
}
