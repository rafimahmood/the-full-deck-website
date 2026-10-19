import { describe, expect, it, vi } from 'vitest';
import { type Env, normalizeEmail, subscribe } from '../netlify/functions/subscribe';

const env: Env = { MAILCHIMP_API_KEY: 'abc123secret-us21', MAILCHIMP_AUDIENCE_ID: 'a1b2c3d4e5', MAILCHIMP_SERVER_PREFIX: 'us21' };
const URL_ = 'https://thefulldeck.netlify.app/api/subscribe';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const mc = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('normalizeEmail', () => {
  it('trims and lowercases', () => expect(normalizeEmail('  Rafi@Example.COM ')).toBe('rafi@example.com'));
  it.each(['', 'nope', 'a@b', 'a b@c.com', '@x.com', 'a@@x.com', 'a..b@x.com', '.a@x.com', 'a@-x.com', 'a@x..com', 'x'.repeat(65) + '@x.com', 5, null])('rejects %j', (v) => expect(normalizeEmail(v)).toBeNull());
  it('accepts plus-addressing and subdomains', () => expect(normalizeEmail('a+deck@mail.example.co.uk')).toBe('a+deck@mail.example.co.uk'));
});

describe('subscribe', () => {
  it('adds a new subscriber with the right Mailchimp request', async () => {
    const f = mc(200, { id: 'x' });
    const res = await subscribe(post({ email: 'Fan@Example.com' }), env, f as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, alreadySubscribed: false, message: "You're on the list." });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://us21.api.mailchimp.com/3.0/lists/a1b2c3d4e5/members');
    expect(JSON.parse(init.body as string)).toEqual({ email_address: 'fan@example.com', status: 'subscribed' });
    expect((init.headers as Record<string, string>).authorization).toBe('Basic ' + Buffer.from('anystring:abc123secret-us21').toString('base64'));
  });

  it('treats "already subscribed" as a friendly success', async () => {
    const res = await subscribe(post({ email: 'fan@example.com' }), env, mc(400, { title: 'Member Exists', status: 400 }) as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, alreadySubscribed: true, message: "You're already on the list." });
  });

  it('rejects invalid emails before calling Mailchimp', async () => {
    const f = mc(200);
    const res = await subscribe(post({ email: 'not-an-email' }), env, f as unknown as typeof fetch);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_email');
    expect(f).not.toHaveBeenCalled();
  });

  it('honeypot: a filled hidden field looks like success but never reaches Mailchimp', async () => {
    const f = mc(200);
    const res = await subscribe(post({ email: 'bot@example.com', company: 'Spam Inc' }), env, f as unknown as typeof fetch);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it('accepts a classic form post too', async () => {
    const f = mc(200);
    const req = new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=a%40b.com&company=' });
    expect((await subscribe(req, env, f as unknown as typeof fetch)).status).toBe(200);
  });

  it('only allows POST, same-site origins, small JSON bodies', async () => {
    const f = mc(200);
    const fx = f as unknown as typeof fetch;
    expect((await subscribe(new Request(URL_, { method: 'GET' }), env, fx)).status).toBe(405);
    expect((await subscribe(post({ email: 'a@b.com' }, { origin: 'https://evil.example' }), env, fx)).status).toBe(403);
    expect((await subscribe(post({ email: 'a@b.com' }, { origin: 'https://thefulldeck.netlify.app' }), env, fx)).status).toBe(200);
    expect((await subscribe(post('{not json'), env, fx)).status).toBe(400);
    expect((await subscribe(post('[]'), env, fx)).status).toBe(400);
    expect((await subscribe(post({ email: 'a@b.com', pad: 'x'.repeat(5000) }), env, fx)).status).toBe(400);
  });

  it('fails clearly when configuration is missing or malformed, without leaking it', async () => {
    const f = mc(200);
    const fx = f as unknown as typeof fetch;
    const missing = await subscribe(post({ email: 'a@b.com' }), { ...env, MAILCHIMP_API_KEY: '' }, fx);
    expect(missing.status).toBe(500);
    expect((await missing.json()).error).toBe('not_configured');
    expect((await subscribe(post({ email: 'a@b.com' }), { ...env, MAILCHIMP_SERVER_PREFIX: 'evil.com/#' }, fx)).status).toBe(500);
    expect((await subscribe(post({ email: 'a@b.com' }), { ...env, MAILCHIMP_AUDIENCE_ID: '../x' }, fx)).status).toBe(500);
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    [401, { title: 'API Key Invalid' }, 500, 'server_error'],
    [404, { title: 'Resource Not Found' }, 500, 'server_error'],
    [429, { title: 'Too Many Requests' }, 503, 'unavailable'],
    [503, {}, 503, 'unavailable'],
    [400, { title: 'Invalid Resource', detail: 'looks fake or invalid' }, 400, 'invalid_email'],
    [400, { title: 'Forgotten Email Not Subscribed' }, 400, 'cannot_resubscribe'],
  ])('maps Mailchimp %i to %i %s and never leaks the key', async (status, body, want, code) => {
    const res = await subscribe(post({ email: 'a@b.com' }), env, mc(status, body) as unknown as typeof fetch);
    expect(res.status).toBe(want);
    const text = await res.text();
    expect(JSON.parse(text).error).toBe(code);
    expect(text).not.toContain('abc123secret');
  });

  it('reports a network failure as a retryable 503', async () => {
    const f = vi.fn(async () => { throw new TypeError('network'); });
    const res = await subscribe(post({ email: 'a@b.com' }), env, f as unknown as typeof fetch);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('unavailable');
  });
});
