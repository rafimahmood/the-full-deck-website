/**
 * POST /api/subscribe   { "email": "you@example.com", "company": "" }
 *
 * Adds an email to the Mailchimp audience. Configuration comes from environment variables
 * (set in Netlify, never committed): MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID, MAILCHIMP_SERVER_PREFIX.
 * "company" is a honeypot: humans never see it, bots fill it in.
 */

export interface Env {
  MAILCHIMP_API_KEY?: string;
  MAILCHIMP_AUDIENCE_ID?: string;
  MAILCHIMP_SERVER_PREFIX?: string;
}

type Fetch = typeof fetch;

const MAX_BODY = 2_000;
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const ok = (alreadySubscribed = false) =>
  json(200, { ok: true, alreadySubscribed, message: alreadySubscribed ? "You're already on the list." : "You're on the list." });

const fail = (status: number, error: string, message: string) => json(status, { ok: false, error, message });

/** Returns the normalised email, or null when it is not a plausible address. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  const [local] = email.split('@');
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  return EMAIL_RE.test(email) ? email : null;
}

/** Same site, localhost, or no Origin header (non-browser). Stops other websites posting to us from a browser. */
function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    const o = new URL(origin);
    return o.host === new URL(req.url).host || o.hostname === 'localhost' || o.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  const type = req.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) {
      const j = JSON.parse(text);
      return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
    }
    return Object.fromEntries(new URLSearchParams(text));
  } catch {
    return null;
  }
}

export async function subscribe(req: Request, env: Env, fetchImpl: Fetch = fetch): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed', message: 'Use POST.' });
  if (!originAllowed(req)) return fail(403, 'forbidden_origin', 'This request is not allowed.');

  const body = await readBody(req);
  if (!body) return fail(400, 'bad_request', 'Something was wrong with that request. Please try again.');

  // Honeypot: pretend it worked so bots learn nothing, and never touch Mailchimp.
  if (typeof body.company === 'string' && body.company.trim() !== '') return ok();

  const email = normalizeEmail(body.email);
  if (!email) return fail(400, 'invalid_email', 'Please enter a valid email address.');

  const key = env.MAILCHIMP_API_KEY?.trim(), list = env.MAILCHIMP_AUDIENCE_ID?.trim(), dc = env.MAILCHIMP_SERVER_PREFIX?.trim();
  if (!key || !list || !dc) {
    console.error('subscribe: Mailchimp environment variables are missing');
    return fail(500, 'not_configured', "Sign-up isn't available right now. Please try again later.");
  }
  // These end up in a URL, so refuse anything that is not the expected shape.
  if (!/^[a-z]{2,5}\d{1,3}$/i.test(dc) || !/^[A-Za-z0-9]{4,40}$/.test(list)) {
    console.error('subscribe: MAILCHIMP_SERVER_PREFIX or MAILCHIMP_AUDIENCE_ID looks wrong');
    return fail(500, 'not_configured', "Sign-up isn't available right now. Please try again later.");
  }

  let res: Response;
  try {
    res = await fetchImpl(`https://${dc.toLowerCase()}.api.mailchimp.com/3.0/lists/${list}/members`, {
      method: 'POST',
      headers: { authorization: 'Basic ' + Buffer.from(`anystring:${key}`).toString('base64'), 'content-type': 'application/json' },
      body: JSON.stringify({ email_address: email, status: 'subscribed' }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('subscribe: could not reach Mailchimp', e instanceof Error ? e.name : 'error');
    return fail(503, 'unavailable', "We couldn't reach the sign-up service. Please try again in a moment.");
  }

  if (res.ok) return ok();

  let detail: { title?: string; detail?: string } = {};
  try { detail = await res.json(); } catch { /* not JSON */ }
  const title = detail.title || '';

  if (res.status === 400 && title === 'Member Exists') return ok(true);
  if (res.status === 400 && title === 'Forgotten Email Not Subscribed')
    return fail(400, 'cannot_resubscribe', "This address can't be added again automatically. Please email us and we'll sort it out.");
  if (res.status === 400 && (title === 'Invalid Resource' || /fake|invalid/i.test(detail.detail || '')))
    return fail(400, 'invalid_email', 'That email address was not accepted. Please check it and try again.');
  if (res.status === 429 || res.status >= 500)
    return fail(503, 'unavailable', 'The sign-up service is busy. Please try again in a moment.');

  // 401/403 (bad key), 404 (bad audience), anything else: our problem, not the visitor's. Log without secrets or the email.
  console.error(`subscribe: Mailchimp returned ${res.status} ${title}`);
  return fail(500, 'server_error', "Sign-up isn't available right now. Please try again later.");
}

export default async (req: Request) => subscribe(req, process.env as Env);

export const config = { path: '/api/subscribe' };
