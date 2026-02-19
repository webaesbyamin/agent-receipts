import { describe, it, expect } from 'vitest'
import { signReceipt, verifyReceipt, getSignablePayload } from '../sign'
import { generateKeyPair } from '../keys'
import type { SignablePayload } from '@agent-receipts/schema'

const basePayload: SignablePayload = {
  receipt_id: 'rcpt_test123',
  chain_id: 'chain_abc',
  receipt_type: 'action',
  agent_id: 'test-agent',
  org_id: 'org_test',
  action: 'test_action',
  input_hash: 'sha256:abc123',
  output_hash: null,
  status: 'pending',
  timestamp: '2026-02-18T12:00:00.000Z',
  completed_at: null,
  environment: 'test',
}

describe('signReceipt / verifyReceipt', () => {
  it('sign then verify returns true (round-trip)', () => {
    const { privateKey, publicKey } = generateKeyPair()
    const signature = signReceipt(basePayload, privateKey)
    const valid = verifyReceipt(basePayload, signature, publicKey)
    expect(valid).toBe(true)
  })

  it('verify with wrong public key returns false', () => {
    const keys1 = generateKeyPair()
    const keys2 = generateKeyPair()
    const signature = signReceipt(basePayload, keys1.privateKey)
    const valid = verifyReceipt(basePayload, signature, keys2.publicKey)
    expect(valid).toBe(false)
  })

  it('verify with tampered payload returns false (change one field)', () => {
    const { privateKey, publicKey } = generateKeyPair()
    const signature = signReceipt(basePayload, privateKey)
    const tampered = { ...basePayload, action: 'tampered_action' }
    const valid = verifyReceipt(tampered, signature, publicKey)
    expect(valid).toBe(false)
  })

  it('verify with tampered signature returns false', () => {
    const { privateKey, publicKey } = generateKeyPair()
    const signature = signReceipt(basePayload, privateKey)
    const tampered = signature.slice(0, -5) + 'XXXXX'
    const valid = verifyReceipt(basePayload, tampered, publicKey)
    expect(valid).toBe(false)
  })

  it('verify with invalid signature format returns false (missing prefix)', () => {
    const { publicKey } = generateKeyPair()
    const valid = verifyReceipt(basePayload, 'invalid:abc123', publicKey)
    expect(valid).toBe(false)
  })

  it('verify with garbage data returns false (does not throw)', () => {
    const valid = verifyReceipt(basePayload, 'ed25519:!!garbage!!', 'not-a-key')
    expect(valid).toBe(false)
  })

  it('signature format is "ed25519:<base64>"', () => {
    const { privateKey } = generateKeyPair()
    const signature = signReceipt(basePayload, privateKey)
    expect(signature).toMatch(/^ed25519:[A-Za-z0-9+/]+=*$/)
  })

  it('same payload + same key = same signature (deterministic)', () => {
    const { privateKey } = generateKeyPair()
    const sig1 = signReceipt(basePayload, privateKey)
    const sig2 = signReceipt(basePayload, privateKey)
    expect(sig1).toBe(sig2)
  })

  it('different payloads = different signatures', () => {
    const { privateKey } = generateKeyPair()
    const sig1 = signReceipt(basePayload, privateKey)
    const sig2 = signReceipt({ ...basePayload, action: 'different' }, privateKey)
    expect(sig1).not.toBe(sig2)
  })
})

describe('getSignablePayload', () => {
  it('extracts exactly 12 fields', () => {
    const fullReceipt = {
      receipt_id: 'rcpt_abc',
      parent_receipt_id: 'rcpt_parent',
      chain_id: 'chain_xyz',
      receipt_type: 'action',
      agent_id: 'test-agent',
      org_id: 'org_test',
      action: 'do_thing',
      input_hash: 'sha256:abc',
      output_hash: 'sha256:def',
      output_summary: 'This should be excluded',
      status: 'completed',
      timestamp: '2026-02-18T12:00:00.000Z',
      completed_at: '2026-02-18T12:00:01.000Z',
      environment: 'production',
      tags: ['tag1', 'tag2'],
      metadata: { key: 'value' },
      signature: 'ed25519:existing',
      verify_url: 'https://example.com/verify/rcpt_abc',
      model: 'gpt-4',
      tokens_in: 100,
      tokens_out: 200,
    }

    const payload = getSignablePayload(fullReceipt)
    const keys = Object.keys(payload)
    expect(keys).toHaveLength(12)
    expect(keys).toContain('receipt_id')
    expect(keys).toContain('chain_id')
    expect(keys).toContain('receipt_type')
    expect(keys).toContain('agent_id')
    expect(keys).toContain('org_id')
    expect(keys).toContain('action')
    expect(keys).toContain('input_hash')
    expect(keys).toContain('output_hash')
    expect(keys).toContain('status')
    expect(keys).toContain('timestamp')
    expect(keys).toContain('completed_at')
    expect(keys).toContain('environment')
  })

  it('ignores non-signed fields', () => {
    const fullReceipt = {
      receipt_id: 'rcpt_abc',
      chain_id: 'chain_xyz',
      receipt_type: 'action',
      agent_id: 'test-agent',
      org_id: 'org_test',
      action: 'do_thing',
      input_hash: 'sha256:abc',
      output_hash: null,
      status: 'pending',
      timestamp: '2026-02-18T12:00:00.000Z',
      completed_at: null,
      environment: 'test',
      output_summary: 'Should be excluded',
      tags: ['excluded'],
      metadata: { excluded: true },
      model: 'gpt-4',
    }

    const payload = getSignablePayload(fullReceipt)
    expect(payload).not.toHaveProperty('output_summary')
    expect(payload).not.toHaveProperty('tags')
    expect(payload).not.toHaveProperty('metadata')
    expect(payload).not.toHaveProperty('model')
  })
})
