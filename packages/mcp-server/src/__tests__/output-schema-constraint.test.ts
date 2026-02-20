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

const objectSchema: Record<string, unknown> = {
  type: 'object',
  required: ['name', 'count'],
  properties: {
    name: { type: 'string' },
    count: { type: 'number', minimum: 0 },
  },
}

describe('output_schema constraint', () => {
  it('passes valid output', () => {
    const receipt = makeReceipt()
    const constraints: ConstraintDefinition[] = [
      { type: 'output_schema', value: objectSchema },
    ]
    const result = evaluateConstraints(receipt, constraints, {
      rawOutput: { name: 'test', count: 5 },
    })
    expect(result.passed).toBe(true)
    expect(result.results[0]!.passed).toBe(true)
  })

  it('fails invalid output', () => {
    const receipt = makeReceipt()
    const constraints: ConstraintDefinition[] = [
      { type: 'output_schema', value: objectSchema },
    ]
    const result = evaluateConstraints(receipt, constraints, {
      rawOutput: { name: 123, count: -1 },
    })
    expect(result.passed).toBe(false)
    expect(result.results[0]!.passed).toBe(false)
  })

  it('fails when rawOutput not available', () => {
    const receipt = makeReceipt()
    const constraints: ConstraintDefinition[] = [
      { type: 'output_schema', value: objectSchema },
    ]
    const result = evaluateConstraints(receipt, constraints)
    expect(result.passed).toBe(false)
    expect(result.results[0]!.message).toContain('raw output data')
  })

  it('reports specific validation errors', () => {
    const receipt = makeReceipt()
    const constraints: ConstraintDefinition[] = [
      { type: 'output_schema', value: objectSchema },
    ]
    const result = evaluateConstraints(receipt, constraints, {
      rawOutput: { name: 'test' }, // missing 'count'
    })
    expect(result.passed).toBe(false)
    expect(result.results[0]!.message).toContain('Schema validation failed')
  })

  it('works with required fields', () => {
    const receipt = makeReceipt()
    const schema = {
      type: 'object',
      required: ['a', 'b', 'c'],
    }
    const result = evaluateConstraints(receipt, [
      { type: 'output_schema', value: schema },
    ], { rawOutput: { a: 1, b: 2, c: 3 } })
    expect(result.passed).toBe(true)
  })

  it('works with nested objects', () => {
    const receipt = makeReceipt()
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      },
    }
    const result = evaluateConstraints(receipt, [
      { type: 'output_schema', value: schema },
    ], { rawOutput: { user: { name: 'Alice' } } })
    expect(result.passed).toBe(true)
  })

  it('works with array items', () => {
    const receipt = makeReceipt()
    const schema = {
      type: 'array',
      items: { type: 'number' },
      minItems: 1,
    }
    const result = evaluateConstraints(receipt, [
      { type: 'output_schema', value: schema },
    ], { rawOutput: [1, 2, 3] })
    expect(result.passed).toBe(true)
  })

  it('integrates with other constraints', () => {
    const receipt = makeReceipt({ latency_ms: 1000 })
    const constraints: ConstraintDefinition[] = [
      { type: 'max_latency_ms', value: 5000 },
      { type: 'output_schema', value: objectSchema },
    ]
    const result = evaluateConstraints(receipt, constraints, {
      rawOutput: { name: 'test', count: 5 },
    })
    expect(result.passed).toBe(true)
    expect(result.results).toHaveLength(2)
    expect(result.results.every(r => r.passed)).toBe(true)
  })
})
