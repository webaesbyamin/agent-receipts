import { describe, it, expect } from 'vitest'
import { generateKeyPair, getPublicKeyFromPrivate } from '../keys'
import { signReceipt, verifyReceipt } from '../sign'
import type { SignablePayload } from '@agentreceipts/schema'

describe('generateKeyPair', () => {
  it('produces valid hex strings', () => {
    const { privateKey, publicKey } = generateKeyPair()
    expect(privateKey).toMatch(/^[0-9a-f]+$/)
    expect(publicKey).toMatch(/^[0-9a-f]+$/)
  })

  it('private key is 64 chars (32 bytes hex)', () => {
    const { privateKey } = generateKeyPair()
    expect(privateKey).toHaveLength(64)
  })

  it('public key is 64 chars (32 bytes hex)', () => {
    const { publicKey } = generateKeyPair()
    expect(publicKey).toHaveLength(64)
  })
})

describe('getPublicKeyFromPrivate', () => {
  it('derives correct public key', () => {
    const { privateKey, publicKey } = generateKeyPair()
    const derived = getPublicKeyFromPrivate(privateKey)
    expect(derived).toBe(publicKey)
  })

  it('sign with generated private key, verify with derived public key', () => {
    const { privateKey } = generateKeyPair()
    const derivedPublicKey = getPublicKeyFromPrivate(privateKey)

    const payload: SignablePayload = {
      receipt_id: 'rcpt_keytest',
      chain_id: 'chain_keytest',
      receipt_type: 'action',
      agent_id: 'key-test-agent',
      org_id: 'org_keytest',
      action: 'key_test_action',
      input_hash: 'sha256:keytest123',
      output_hash: null,
      status: 'pending',
      timestamp: '2026-02-18T14:00:00.000Z',
      completed_at: null,
      environment: 'test',
    }

    const signature = signReceipt(payload, privateKey)
    const valid = verifyReceipt(payload, signature, derivedPublicKey)
    expect(valid).toBe(true)
  })
})
