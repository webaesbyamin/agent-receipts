// The waitlist route against a mocked Buttondown (no network, no real key).
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { subscribe as POST, context, tag } from '../src/lib/waitlist.ts'

const realFetch = globalThis.fetch
let calls
const reply = (status, body = '') => {
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(body, { status }) }
}
const post = (body) => POST(new Request('http://localhost/api/waitlist', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }))
const ok = { email: 'studio@example.com', role: 'agency', pay: 'per-client', worth: '40', use: 'client deliverables' }

beforeEach(() => { calls = []; process.env.BUTTONDOWN_API_KEY = 'test-key'; console.error = () => {} })
afterEach(() => { globalThis.fetch = realFetch; delete process.env.BUTTONDOWN_API_KEY })

test('201: subscribed, with the tags and notes Buttondown should get', async () => {
  reply(201, '{}')
  const res = await post(ok)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, status: 'subscribed' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.buttondown.com/v1/subscribers')
  assert.equal(calls[0].init.headers.Authorization, 'Token test-key')
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email_address: 'studio@example.com',
    tags: ['agent-receipts-waitlist', 'role:agency', 'pay:per-client'],
    notes: 'worth: $40; use: client deliverables',
  })
})

test('400 "already exists": already on the list', async () => {
  reply(400, '{"code":"email_already_exists","detail":"This email address already exists."}')
  const res = await post(ok)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, status: 'existing' })
})

test('400 rejected address: 422 with the route message', async () => {
  reply(400, '{"code":"email_invalid","detail":"That email address is not valid."}')
  const res = await post(ok)
  assert.equal(res.status, 422)
  assert.equal((await res.json()).error, 'That email address was rejected. Please try another.')
})

test('401 bad key: 503, nothing about the key', async () => {
  reply(401, '{"detail":"Invalid token."}')
  const res = await post(ok)
  assert.equal(res.status, 503)
  assert.equal((await res.json()).error, 'The waitlist is temporarily unavailable. Please try again later.')
})

test('429: passed on', async () => {
  reply(429, 'slow down')
  const res = await post(ok)
  assert.equal(res.status, 429)
  assert.equal((await res.json()).error, 'Too many attempts. Please try again shortly.')
})

test('honeypot filled: pretend success, never call Buttondown', async () => {
  reply(201)
  const res = await post({ ...ok, hp_token: 'x' })
  assert.deepEqual(await res.json(), { ok: true, status: 'subscribed' })
  assert.equal(calls.length, 0)
})

test('invalid email: 422, never call Buttondown', async () => {
  reply(201)
  for (const email of ['', 'nope', 'a@b', 'a b@c.d', 42]) {
    const res = await post({ ...ok, email })
    assert.equal(res.status, 422)
    assert.equal((await res.json()).error, 'Enter a valid email address.')
  }
  assert.equal(calls.length, 0)
})

test('no BUTTONDOWN_API_KEY: 503 and the not-open message', async () => {
  delete process.env.BUTTONDOWN_API_KEY
  reply(201)
  const res = await post(ok)
  assert.equal(res.status, 503)
  assert.equal((await res.json()).error, 'The waitlist isn’t open yet. Please try again later.')
  assert.equal(calls.length, 0)
})

test('not JSON: 400', async () => {
  const res = await post('email=a@b.c')
  assert.equal(res.status, 400)
})

test('unknown answers are dropped; tags are sanitized and capped at 40; notes at 500', () => {
  const c = context({ role: 'admin"><script>', pay: 'yes', worth: '$ 25', use: 'x'.repeat(900) })
  assert.deepEqual(c.tags, ['agent-receipts-waitlist'])
  assert.ok(c.notes.startsWith('worth: $25; use: xxx'))
  assert.equal(c.notes.length, 500)
  assert.equal(tag('Role:Building An AI Product!!' + 'z'.repeat(60)).length, 40)
  assert.match(tag('Role:Building An AI Product!!'), /^[a-z0-9:-]+$/)
})
