import { describe, it, expect } from 'vitest'
import { canonicalize } from '../canonical'
import type { SignablePayload } from '@agentreceipts/schema'

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

describe('canonicalize', () => {
  it('same object with different key order produces same output', () => {
    const payload1: SignablePayload = {
      receipt_id: 'rcpt_test',
      chain_id: 'chain_1',
      receipt_type: 'action',
      agent_id: 'agent-1',
      org_id: 'org_1',
      action: 'do_thing',
      input_hash: 'sha256:abc',
      output_hash: null,
      status: 'pending',
      timestamp: '2026-02-18T12:00:00.000Z',
      completed_at: null,
      environment: 'test',
    }

    // Create with different insertion order
    const payload2 = {} as Record<string, unknown>
    payload2.environment = 'test'
    payload2.status = 'pending'
    payload2.action = 'do_thing'
    payload2.receipt_id = 'rcpt_test'
    payload2.agent_id = 'agent-1'
    payload2.org_id = 'org_1'
    payload2.chain_id = 'chain_1'
    payload2.receipt_type = 'action'
    payload2.input_hash = 'sha256:abc'
    payload2.output_hash = null
    payload2.timestamp = '2026-02-18T12:00:00.000Z'
    payload2.completed_at = null

    expect(canonicalize(payload1)).toBe(canonicalize(payload2 as SignablePayload))
  })

  it('all 12 SignablePayload fields present in output', () => {
    const result = canonicalize(basePayload)
    const parsed = JSON.parse(result)
    const keys = Object.keys(parsed)
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

  it('null values serialized as null (not omitted)', () => {
    const result = canonicalize(basePayload)
    const parsed = JSON.parse(result)
    expect(parsed.output_hash).toBeNull()
    expect(parsed.completed_at).toBeNull()
    expect('output_hash' in parsed).toBe(true)
    expect('completed_at' in parsed).toBe(true)
  })

  it('output is valid JSON', () => {
    const result = canonicalize(basePayload)
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('empty strings are preserved', () => {
    const payload: SignablePayload = {
      ...basePayload,
      action: '',
      input_hash: '',
    }
    const result = canonicalize(payload)
    const parsed = JSON.parse(result)
    expect(parsed.action).toBe('')
    expect(parsed.input_hash).toBe('')
  })

  it('datetime strings are preserved exactly', () => {
    const result = canonicalize(basePayload)
    const parsed = JSON.parse(result)
    expect(parsed.timestamp).toBe('2026-02-18T12:00:00.000Z')
  })
})
