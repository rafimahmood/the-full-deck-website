import { describe, expect, it } from 'vitest';
import {
  ALL_DENIED, Analytics, type AnalyticsEnv, CHOICE_MAX_AGE_MS, GA_ID, STORAGE_KEY, gaCookieNames, gtagScriptUrl, readChoice, saveChoice,
} from '../src/consent';

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
};

const recorder = () => {
  const calls: unknown[][] = [];
  const scripts: string[] = [];
  const disabled: Array<[string, boolean]> = [];
  let cookiesCleared = 0;
  const env: AnalyticsEnv = {
    gtag: (...args) => { calls.push(args); },
    loadScript: (src) => { scripts.push(src); },
    setDisabled: (id, d) => { disabled.push([id, d]); },
    clearCookies: () => { cookiesCleared++; },
  };
  return { env, calls, scripts, disabled, cleared: () => cookiesCleared };
};

describe('consent defaults', () => {
  it('denies every Consent Mode v2 category', () => {
    expect(Object.keys(ALL_DENIED).sort()).toEqual([
      'ad_personalization', 'ad_storage', 'ad_user_data', 'analytics_storage', 'functionality_storage', 'personalization_storage', 'security_storage',
    ]);
    expect(Object.values(ALL_DENIED).every((v) => v === 'denied')).toBe(true);
  });
  it('uses the right measurement ID', () => {
    expect(GA_ID).toBe('G-BNTY8C42YG');
    expect(gtagScriptUrl()).toBe('https://www.googletagmanager.com/gtag/js?id=G-BNTY8C42YG');
  });
});

describe('Analytics', () => {
  it('declares everything denied on creation, and loads nothing', () => {
    const r = recorder();
    const a = new Analytics(r.env);
    expect(r.calls).toEqual([['consent', 'default', { ...ALL_DENIED }]]);
    expect(r.scripts).toEqual([]);
    expect(a.loaded).toBe(false);
  });

  it('loads Google\'s tag only after grant, with consent updated first', () => {
    const r = recorder();
    const a = new Analytics(r.env);
    a.grant();
    expect(a.loaded).toBe(true);
    expect(r.scripts).toEqual([gtagScriptUrl()]);
    expect(r.calls.map((c) => c.slice(0, 2).join(' '))).toEqual(['consent default', 'consent update', 'js ' + String(r.calls[2]?.[1]), 'config G-BNTY8C42YG']);
    expect(r.calls[1]).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
  });

  it('only grants analytics storage, never advertising', () => {
    const r = recorder();
    new Analytics(r.env).grant();
    const update = r.calls.find((c) => c[0] === 'consent' && c[1] === 'update')?.[2] as Record<string, string>;
    expect(Object.keys(update)).toEqual(['analytics_storage']);
    const config = r.calls.find((c) => c[0] === 'config')?.[2] as Record<string, boolean>;
    expect(config).toEqual({ allow_google_signals: false, allow_ad_personalization_signals: false });
  });

  it('loads the tag once even if granted twice', () => {
    const r = recorder();
    const a = new Analytics(r.env);
    a.grant();
    a.grant();
    expect(r.scripts).toHaveLength(1);
    expect(r.calls.filter((c) => c[0] === 'config')).toHaveLength(1);
  });

  it('rejecting loads nothing and clears any Analytics cookies', () => {
    const r = recorder();
    const a = new Analytics(r.env);
    a.revoke();
    expect(r.scripts).toEqual([]);
    expect(a.loaded).toBe(false);
    expect(r.cleared()).toBe(1);
    expect(r.disabled).toEqual([[GA_ID, true]]);
    expect(r.calls.at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
  });

  it('withdrawing after accepting switches collection off and clears cookies', () => {
    const r = recorder();
    const a = new Analytics(r.env);
    a.grant();
    a.revoke();
    expect(r.calls.at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(r.disabled.at(-1)).toEqual([GA_ID, true]);
    expect(r.cleared()).toBe(1);
  });

  it('accepting again later re-enables without loading a second tag', () => {
    const r = recorder();
    const a = new Analytics(r.env);
    a.grant();
    a.revoke();
    a.grant();
    expect(r.scripts).toHaveLength(1);
    expect(r.disabled.at(-1)).toEqual([GA_ID, false]);
    expect(r.calls.at(-1)).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
  });
});

describe('remembered choice', () => {
  const now = 1_800_000_000_000;

  it('round-trips both answers', () => {
    for (const choice of ['granted', 'denied'] as const) {
      const s = memory();
      expect(saveChoice(s, choice, now)).toBe(true);
      expect(readChoice(s, now + 1000)).toBe(choice);
    }
  });
  it('has no choice until one is made', () => expect(readChoice(memory(), now)).toBeNull());
  it('asks again after a year', () => {
    const s = memory();
    saveChoice(s, 'granted', now);
    expect(readChoice(s, now + CHOICE_MAX_AGE_MS - 1)).toBe('granted');
    expect(readChoice(s, now + CHOICE_MAX_AGE_MS + 1)).toBeNull();
  });
  it.each(['', 'granted', '{}', '{"choice":"maybe","at":1}', '{"choice":"granted"}', '{"choice":"granted","at":"x"}', 'not json', 'null'])(
    'ignores a damaged value %j (and treats it as no choice)',
    (raw) => expect(readChoice(memory({ [STORAGE_KEY]: raw }), now)).toBeNull(),
  );
  it('copes with storage being unavailable', () => {
    expect(readChoice(null)).toBeNull();
    expect(saveChoice(null, 'granted')).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readChoice(broken)).toBeNull();
    expect(saveChoice(broken, 'denied')).toBe(false);
  });
});

describe('gaCookieNames', () => {
  it('picks out Google Analytics cookies and nothing else', () => {
    expect(gaCookieNames(['_ga', '_ga_BNTY8C42YG', '_gid', '_gat_gtag_G_BNTY8C42YG', 'theme', 'fd-consent', '_gaming', '_ga_OTHER'])).toEqual([
      '_ga', '_ga_BNTY8C42YG', '_gid', '_gat_gtag_G_BNTY8C42YG',
    ]);
  });
  it('is empty when there are none', () => expect(gaCookieNames(['a', 'b'])).toEqual([]));
});
