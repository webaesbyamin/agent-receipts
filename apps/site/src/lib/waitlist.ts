// Server-side Buttondown subscribe for the early-access stub (POST
// /api/waitlist, wired up in src/app/api/waitlist/route.ts), the same pattern
// as webaes.com's app/api/subscribe/route.ts. The API key lives only here, in
// the BUTTONDOWN_API_KEY env var, and never reaches the browser. The form posts
// to this same-origin route, which proxies to Buttondown so the visitor gets
// real success / duplicate / error feedback.
//
// No imports on purpose: test/waitlist.test.mjs loads this file directly.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const BUTTONDOWN_URL = 'https://api.buttondown.com/v1/subscribers'

export const ROLES = ['agency', 'freelancer', 'dev-team', 'ai-product', 'other'] as const
export const PAY = ['monthly', 'per-client', 'maybe', 'no'] as const

type Body = { email?: unknown; hp_token?: unknown; role?: unknown; pay?: unknown; worth?: unknown; use?: unknown }

/** Lower-case, letters/digits/dash/colon only, at most 40 characters: safe as a Buttondown tag. */
export const tag = (s: string) => s.toLowerCase().replace(/[^a-z0-9:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

const pick = <T extends readonly string[]>(list: T, v: unknown): T[number] | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T[number]) : null

/** What goes to Buttondown besides the address: tags and a one-line note. */
export function context(body: Body): { tags: string[]; notes: string } {
  const role = pick(ROLES, body.role)
  const pay = pick(PAY, body.pay)
  const tags = ['agent-receipts-waitlist', ...(role ? [`role:${role}`] : []), ...(pay ? [`pay:${pay}`] : [])].map(tag)
  const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
  const worth = clean(body.worth).replace(/^\$\s*/, '')
  const notes = `worth: ${worth ? `$${worth}` : '-'}; use: ${clean(body.use) || '-'}`.slice(0, 500)
  return { tags, notes }
}

const json = (body: unknown, status = 200) => Response.json(body, { status })

export async function subscribe(req: Request): Promise<Response> {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  if (!body || typeof body !== 'object') return json({ error: 'Bad request.' }, 400)

  // Honeypot: bots fill the hidden field; people never see it. Pretend
  // success so the bot moves on without learning it was caught.
  if (body.hp_token) return json({ ok: true, status: 'subscribed' })

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 422)

  const key = process.env.BUTTONDOWN_API_KEY
  if (!key) {
    // Misconfiguration, surfaced clearly so signups never fail silently
    return json({ error: 'The waitlist isn’t open yet. Please try again later.' }, 503)
  }

  const { tags, notes } = context(body)
  let res: Response
  try {
    res = await fetch(BUTTONDOWN_URL, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_address: email, tags, notes }),
    })
  } catch {
    return json({ error: 'Couldn’t reach the waitlist service. Try again.' }, 502)
  }

  // Double opt-in is Buttondown's default: a confirmation email goes out first
  if (res.status === 201) return json({ ok: true, status: 'subscribed' })

  const detail = (await res.text()).toLowerCase()
  // Server logs only (Vercel → Logs); the body holds no secret
  console.error(`[waitlist] buttondown ${res.status}: ${detail.slice(0, 200)}`)

  // 400 with an "already exists" detail: they're already on the list
  if (res.status === 400 && (detail.includes('already') || detail.includes('exists') || detail.includes('subscribed'))) {
    return json({ ok: true, status: 'existing' })
  }
  // Any other 400/422 from Buttondown: it rejected the address (invalid or disposable)
  if (res.status === 400 || res.status === 422) {
    return json({ error: 'That email address was rejected. Please try another.' }, 422)
  }
  // Bad or missing credentials: ours to fix, not the visitor's
  if (res.status === 401 || res.status === 403) {
    return json({ error: 'The waitlist is temporarily unavailable. Please try again later.' }, 503)
  }
  if (res.status === 429) return json({ error: 'Too many attempts. Please try again shortly.' }, 429)
  return json({ error: 'Couldn’t sign you up right now. Try again.' }, 502)
}
