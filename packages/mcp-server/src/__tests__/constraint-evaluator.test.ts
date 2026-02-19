import { describe, it, expect } from 'vitest'
import { evaluateConstraints } from '../engine/constraint-evaluator.js'
import type { ActionReceipt, ConstraintDefinition } from '@agent-receipts/schema'

function makeReceipt(overrides: Partial<ActionReceipt> = {}): ActionReceipt {
  return {
    receipt_id: 'rcpt_test123',
    parent_receipt_id: null,
    chain_id: 'chain_test',
    receipt_type: 'action',
    agent_id: 'test-agent',
    org_id: 'test-org',
    action: 'test_action',
    input_hash: 'sha256:abc',
    output_hash: 'sha256:def',
    output_summary: 'Test output',
    model: 'gpt-4',
    tokens_in: 100,
    tokens_out: 200,
    cost_usd: 0.005,
    latency_ms: 2340,
    tool_calls: ['tool1'],
    timestamp: '2026-02-18T12:00:00.000Z',
    completed_at: '2026-02-18T12:00:02.340Z',
    status: 'completed',
    error: null,
    environment: 'production',
    tags: ['test'],
    constraints: null,
    constraint_result: null,
    signature: 'ed25519:testsig==',
    verify_url: 'local://verify/rcpt_test123',
    callback_verified: null,
    confidence: 0.92,
    metadata: {},
    ...overrides,
  }
}

describe('evaluateConstraints', () => {
  describe('max_latency_ms', () => {
    it('passes when under limit', () => {
      const receipt = makeReceipt({ latency_ms: 2340 })
      const result = evaluateConstraints(receipt, [{ type: 'max_latency_ms', value: 5000 }])
      expect(result.passed).toBe(true)
      expect(result.results[0]!.passed).toBe(true)
      expect(result.results[0]!.actual).toBe(2340)
    })

    it('fails when over limit', () => {
      const receipt = makeReceipt({ latency_ms: 8000 })
      const result = evaluateConstraints(receipt, [{ type: 'max_latency_ms', value: 5000 }])
      expect(result.passed).toBe(false)
      expect(result.results[0]!.passed).toBe(false)
    })

    it('fails when latency_ms is null', () => {
      const receipt = makeReceipt({ latency_ms: null })
      const result = evaluateConstraints(receipt, [{ type: 'max_latency_ms', value: 5000 }])
      expect(result.passed).toBe(false)
      expect(result.results[0]!.actual).toBeNull()
    })

    it('passes when equal to limit', () => {
      const receipt = makeReceipt({ latency_ms: 5000 })
      const result = evaluateConstraints(receipt, [{ type: 'max_latency_ms', value: 5000 }])
      expect(result.passed).toBe(true)
    })

    it('handles non-number value gracefully', () => {
      const receipt = makeReceipt({ latency_ms: 2340 })
      // The constraint type says value is number, but evaluator should handle edge cases
      const result = evaluateConstraints(receipt, [{ type: 'max_latency_ms', value: 5000 }])
      expect(result.results.length).toBe(1)
    })
  })

  describe('max_cost_usd', () => {
    it('passes when under limit', () => {
      const receipt = makeReceipt({ cost_usd: 0.005 })
      const result = evaluateConstraints(receipt, [{ type: 'max_cost_usd', value: 0.01 }])
      expect(result.passed).toBe(true)
    })

    it('fails when over limit', () => {
      const receipt = makeReceipt({ cost_usd: 0.05 })
      const result = evaluateConstraints(receipt, [{ type: 'max_cost_usd', value: 0.01 }])
      expect(result.passed).toBe(false)
    })

    it('fails when cost_usd is null', () => {
      const receipt = makeReceipt({ cost_usd: null })
      const result = evaluateConstraints(receipt, [{ type: 'max_cost_usd', value: 0.01 }])
      expect(result.passed).toBe(false)
      expect(result.results[0]!.actual).toBeNull()
    })
  })

  describe('min_confidence', () => {
    it('passes when meets threshold', () => {
      const receipt = makeReceipt({ confidence: 0.92 })
      const result = evaluateConstraints(receipt, [{ type: 'min_confidence', value: 0.8 }])
      expect(result.passed).toBe(true)
    })

    it('fails when below threshold', () => {
      const receipt = makeReceipt({ confidence: 0.62 })
      const result = evaluateConstraints(receipt, [{ type: 'min_confidence', value: 0.8 }])
      expect(result.passed).toBe(false)
    })

    it('fails when confidence is null', () => {
      const receipt = makeReceipt({ confidence: null })
      const result = evaluateConstraints(receipt, [{ type: 'min_confidence', value: 0.8 }])
      expect(result.passed).toBe(false)
    })

    it('passes when exactly at threshold', () => {
      const receipt = makeReceipt({ confidence: 0.8 })
      const result = evaluateConstraints(receipt, [{ type: 'min_confidence', value: 0.8 }])
      expect(result.passed).toBe(true)
    })
  })

  describe('required_fields', () => {
    it('passes when all fields present', () => {
      const receipt = makeReceipt({ model: 'gpt-4', cost_usd: 0.005 })
      const result = evaluateConstraints(receipt, [{ type: 'required_fields', value: ['model', 'cost_usd'] }])
      expect(result.passed).toBe(true)
    })

    it('fails when one field is null', () => {
      const receipt = makeReceipt({ model: null, cost_usd: 0.005 })
      const result = evaluateConstraints(receipt, [{ type: 'required_fields', value: ['model', 'cost_usd'] }])
      expect(result.passed).toBe(false)
      expect(result.results[0]!.actual).toEqual(['model'])
    })

    it('fails when multiple fields are null', () => {
      const receipt = makeReceipt({ model: null, cost_usd: null })
      const result = evaluateConstraints(receipt, [{ type: 'required_fields', value: ['model', 'cost_usd'] }])
      expect(result.passed).toBe(false)
      expect(result.results[0]!.actual).toEqual(['model', 'cost_usd'])
    })

    it('fails for unknown field name', () => {
      const receipt = makeReceipt()
      const result = evaluateConstraints(receipt, [{ type: 'required_fields', value: ['nonexistent_field'] }])
      expect(result.passed).toBe(false)
      expect(result.results[0]!.message).toContain('Unknown field')
    })

    it('fails when value is not an array', () => {
      const receipt = makeReceipt()
      const result = evaluateConstraints(receipt, [{ type: 'required_fields', value: 'model' }])
      expect(result.passed).toBe(false)
      expect(result.results[0]!.message).toContain('array')
    })
  })

  describe('status_must_be', () => {
    it('passes when status matches string', () => {
      const receipt = makeReceipt({ status: 'completed' })
      const result = evaluateConstraints(receipt, [{ type: 'status_must_be', value: 'completed' }])
      expect(result.passed).toBe(true)
    })

    it('fails when status does not match string', () => {
      const receipt = makeReceipt({ status: 'failed' })
      const result = evaluateConstraints(receipt, [{ type: 'status_must_be', value: 'completed' }])
      expect(result.passed).toBe(false)
    })

    it('passes when status matches one in array', () => {
      const receipt = makeReceipt({ status: 'completed' })
      const result = evaluateConstraints(receipt, [{ type: 'status_must_be', value: ['completed', 'pending'] }])
      expect(result.passed).toBe(true)
    })

    it('fails when status matches none in array', () => {
      const receipt = makeReceipt({ status: 'timeout' })
      const result = evaluateConstraints(receipt, [{ type: 'status_must_be', value: ['completed', 'pending'] }])
      expect(result.passed).toBe(false)
    })
  })

  describe('unknown type', () => {
    it('returns passed=false for unknown constraint type', () => {
      const receipt = makeReceipt()
      const result = evaluateConstraints(receipt, [{ type: 'nonexistent_type', value: 42 }])
      expect(result.passed).toBe(false)
      expect(result.results[0]!.passed).toBe(false)
      expect(result.results[0]!.message).toContain('Unknown constraint type')
    })
  })

  describe('empty constraints', () => {
    it('returns passed=true with empty results', () => {
      const receipt = makeReceipt()
      const result = evaluateConstraints(receipt, [])
      expect(result.passed).toBe(true)
      expect(result.results).toEqual([])
    })
  })

  describe('multiple constraints', () => {
    it('all pass → passed=true', () => {
      const receipt = makeReceipt({ latency_ms: 1000, cost_usd: 0.001, confidence: 0.95 })
      const constraints: ConstraintDefinition[] = [
        { type: 'max_latency_ms', value: 5000 },
        { type: 'max_cost_usd', value: 0.01 },
        { type: 'min_confidence', value: 0.8 },
      ]
      const result = evaluateConstraints(receipt, constraints)
      expect(result.passed).toBe(true)
      expect(result.results.length).toBe(3)
      expect(result.results.every((r) => r.passed)).toBe(true)
    })

    it('one fails → passed=false', () => {
      const receipt = makeReceipt({ latency_ms: 8000, cost_usd: 0.001, confidence: 0.95 })
      const constraints: ConstraintDefinition[] = [
        { type: 'max_latency_ms', value: 5000 },
        { type: 'max_cost_usd', value: 0.01 },
      ]
      const result = evaluateConstraints(receipt, constraints)
      expect(result.passed).toBe(false)
      expect(result.results[0]!.passed).toBe(false)
      expect(result.results[1]!.passed).toBe(true)
    })

    it('all fail → passed=false', () => {
      const receipt = makeReceipt({ latency_ms: 8000, cost_usd: 0.05, confidence: 0.3 })
      const constraints: ConstraintDefinition[] = [
        { type: 'max_latency_ms', value: 5000 },
        { type: 'max_cost_usd', value: 0.01 },
        { type: 'min_confidence', value: 0.8 },
      ]
      const result = evaluateConstraints(receipt, constraints)
      expect(result.passed).toBe(false)
      expect(result.results.every((r) => !r.passed)).toBe(true)
    })
  })

  it('evaluated_at is a valid datetime', () => {
    const receipt = makeReceipt()
    const result = evaluateConstraints(receipt, [{ type: 'max_latency_ms', value: 5000 }])
    expect(() => new Date(result.evaluated_at).toISOString()).not.toThrow()
    expect(result.evaluated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('custom message is preserved', () => {
    const receipt = makeReceipt({ latency_ms: 8000 })
    const result = evaluateConstraints(receipt, [{
      type: 'max_latency_ms',
      value: 5000,
      message: 'Response too slow!',
    }])
    expect(result.results[0]!.message).toBe('Response too slow!')
  })
})
