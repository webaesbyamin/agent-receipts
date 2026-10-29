import { describe, it, expect } from 'vitest'
import { generateKeyPair } from '../keys'
import { signReceipt, getSignablePayload } from '../sign'
import {
  canonicalizeDeep,
  getSignablePayloadV2,
  signReceiptV2,
  verifyReceiptV2,
  verifyAnyReceipt,
  computeKeyId,
  hashReceipt,
} from '../v2'

function baseReceipt(): Record<string, unknown> {
  return {
    sig_version: 2,
    key_id: null,
    prev_receipt_hash: null,
    files: [{ name: 'in.txt', sha256: `sha256:${'a'.repeat(64)}`, bytes: 3, role: 'input' }],
    receipt_id: 'rcpt_test',
    parent_receipt_id: null,
    chain_id: 'chain_test',
    receipt_type: 'action',
    agent_id: 'agent',
    org_id: 'org',
    action: 'write_description',
    input_hash: 'sha256:in',
    output_hash: 'sha256:out',
    output_summary: 'Wrote a 90-word description',
    model: 'claude-test',
    tokens_in: 10,
    tokens_out: 20,
    cost_usd: 0.0123,
    latency_ms: 1500,
    tool_calls: ['Read', 'Write'],
    timestamp: '2026-10-28T12:00:00.000Z',
    completed_at: '2026-10-28T12:00:01.500Z',
    status: 'completed',
    error: null,
    environment: 'production',
    tags: ['magic-folder'],
    constraints: null,
    constraint_result: null,
    signature: '',
    verify_url: 'local://verify/rcpt_test',
    callback_verified: null,
    confidence: null,
    metadata: { recipe: 'Write product descriptions', nested: { b: 2, a: 1 } },
  }
}

function signed(privateKey: string, publicKey: string): Record<string, unknown> {
  const r = baseReceipt()
  r['key_id'] = computeKeyId(publicKey)
  r['signature'] = signReceiptV2(r, privateKey)
  return r
}

describe('canonicalizeDeep', () => {
  it('sorts keys at every depth and keeps array order', () => {
    expect(canonicalizeDeep({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 2 } }))
      .toBe('{"a":{"c":2,"d":[3,{"y":2,"z":1}]},"b":1}')
  })

  it('keeps nested keys the flat v1 canonicalizer would drop', () => {
    expect(canonicalizeDeep({ metadata: { recipe: 'x' } })).toContain('recipe')
  })

  it('drops undefined values like JSON.stringify', () => {
    expect(canonicalizeDeep({ a: undefined, b: null })).toBe('{"b":null}')
  })
})

describe('v2 signatures', () => {
  const { privateKey, publicKey } = generateKeyPair()

  it('excludes only signature and verify_url from the payload', () => {
    const payload = getSignablePayloadV2(baseReceipt())
    expect('signature' in payload).toBe(false)
    expect('verify_url' in payload).toBe(false)
    expect('output_summary' in payload).toBe(true)
    expect('files' in payload).toBe(true)
  })

  it('verifies an untouched receipt', () => {
    expect(verifyReceiptV2(signed(privateKey, publicKey), publicKey)).toBe(true)
  })

  it.each([
    ['output_summary', 'Something else'],
    ['cost_usd', 0],
    ['model', 'other-model'],
    ['metadata', { recipe: 'Other' }],
    ['prev_receipt_hash', 'sha256:forged'],
    ['files', []],
    ['parent_receipt_id', 'rcpt_other'],
    ['tags', null],
  ])('rejects a receipt whose %s was changed', (field: string, value: unknown) => {
    const r = signed(privateKey, publicKey)
    r[field] = value
    expect(verifyReceiptV2(r, publicKey)).toBe(false)
  })

  it('still verifies when verify_url changes (it is not signed)', () => {
    const r = signed(privateKey, publicKey)
    r['verify_url'] = 'https://example.com/verify/rcpt_test'
    expect(verifyReceiptV2(r, publicKey)).toBe(true)
  })

  it('rejects the wrong key', () => {
    const other = generateKeyPair()
    expect(verifyReceiptV2(signed(privateKey, publicKey), other.publicKey)).toBe(false)
  })

  it('refuses to sign without sig_version 2', () => {
    const r = baseReceipt()
    delete r['sig_version']
    expect(() => signReceiptV2(r, privateKey)).toThrow('sig_version')
  })
})

describe('verifyAnyReceipt', () => {
  const { privateKey, publicKey } = generateKeyPair()

  it('reports v2 coverage and a matching key_id', () => {
    const result = verifyAnyReceipt(signed(privateKey, publicKey), publicKey)
    expect(result).toEqual({ valid: true, sig_version: 2, covers_all_fields: true, key_id_matches: true })
  })

  it('still verifies legacy v1 receipts', () => {
    const r = baseReceipt()
    delete r['sig_version']
    r['signature'] = signReceipt(getSignablePayload(r as Parameters<typeof getSignablePayload>[0]), privateKey)
    const result = verifyAnyReceipt(r, publicKey)
    expect(result.valid).toBe(true)
    expect(result.sig_version).toBe(1)
    expect(result.covers_all_fields).toBe(false)
  })

  it('catches a downgrade: stripping sig_version from a v2 receipt does not verify', () => {
    const r = signed(privateKey, publicKey)
    delete r['sig_version']
    expect(verifyAnyReceipt(r, publicKey).valid).toBe(false)
  })

  it('rejects v1 receipts when requireV2 is set', () => {
    const r = baseReceipt()
    delete r['sig_version']
    r['signature'] = signReceipt(getSignablePayload(r as Parameters<typeof getSignablePayload>[0]), privateKey)
    expect(verifyAnyReceipt(r, publicKey, { requireV2: true }).valid).toBe(false)
  })
})

describe('computeKeyId / hashReceipt', () => {
  it('computeKeyId is stable and short', () => {
    const { publicKey } = generateKeyPair()
    expect(computeKeyId(publicKey)).toMatch(/^key_[0-9a-f]{16}$/)
    expect(computeKeyId(publicKey)).toBe(computeKeyId(publicKey))
  })

  it('hashReceipt changes when any field, including the signature, changes', () => {
    const r = baseReceipt()
    const h1 = hashReceipt(r)
    expect(h1).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(hashReceipt({ ...r, signature: 'ed25519:x' })).not.toBe(h1)
    expect(hashReceipt({ ...r })).toBe(h1)
  })
})

describe('prototype keys', () => {
  it('a __proto__ key added to a signed receipt breaks the signature', () => {
    const { privateKey, publicKey } = generateKeyPair()
    const r = baseReceipt()
    r['signature'] = signReceiptV2(r, privateKey)
    const tampered = JSON.parse(JSON.stringify(r).replace('{', '{"__proto__":{"injected":true},'))
    expect(Object.keys(tampered)).toContain('__proto__')
    expect(verifyReceiptV2(tampered, publicKey)).toBe(false)
    const nested = JSON.parse(JSON.stringify(r).replace('"metadata":{', '"metadata":{"__proto__":{"x":1},'))
    expect(verifyReceiptV2(nested, publicKey)).toBe(false)
  })

  it('hashReceipt distinguishes a receipt with an extra __proto__ key', () => {
    const r = baseReceipt()
    const withProto = JSON.parse(JSON.stringify(r).replace('{', '{"__proto__":{"a":1},'))
    expect(hashReceipt(withProto)).not.toBe(hashReceipt(r))
  })
})
