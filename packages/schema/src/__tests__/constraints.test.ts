import { describe, it, expect } from 'vitest'
import {
  ConstraintDefinition,
  SingleConstraintResult,
  ConstraintResult,
  ConstraintDefinitions,
} from '../index'

describe('ConstraintDefinition', () => {
  it('valid definition passes', () => {
    const result = ConstraintDefinition.safeParse({
      type: 'max_latency_ms',
      value: 5000,
    })
    expect(result.success).toBe(true)
  })

  it('empty type fails', () => {
    const result = ConstraintDefinition.safeParse({
      type: '',
      value: 5000,
    })
    expect(result.success).toBe(false)
  })

  it('message is optional', () => {
    const withMessage = ConstraintDefinition.safeParse({
      type: 'max_latency_ms',
      value: 5000,
      message: 'Must be under 5s',
    })
    expect(withMessage.success).toBe(true)

    const withoutMessage = ConstraintDefinition.safeParse({
      type: 'max_latency_ms',
      value: 5000,
    })
    expect(withoutMessage.success).toBe(true)
  })

  it('value accepts number', () => {
    const result = ConstraintDefinition.safeParse({ type: 'max_cost_usd', value: 0.01 })
    expect(result.success).toBe(true)
  })

  it('value accepts string', () => {
    const result = ConstraintDefinition.safeParse({ type: 'status_must_be', value: 'completed' })
    expect(result.success).toBe(true)
  })

  it('value accepts array', () => {
    const result = ConstraintDefinition.safeParse({
      type: 'required_fields',
      value: ['model', 'cost_usd'],
    })
    expect(result.success).toBe(true)
  })

  it('value accepts object', () => {
    const result = ConstraintDefinition.safeParse({
      type: 'custom',
      value: { threshold: 0.5, mode: 'strict' },
    })
    expect(result.success).toBe(true)
  })

  it('value accepts boolean', () => {
    const result = ConstraintDefinition.safeParse({ type: 'custom_flag', value: true })
    expect(result.success).toBe(true)
  })
})

describe('SingleConstraintResult', () => {
  it('valid result passes', () => {
    const result = SingleConstraintResult.safeParse({
      type: 'max_latency_ms',
      passed: true,
      expected: 5000,
      actual: 2340,
    })
    expect(result.success).toBe(true)
  })

  it('valid result with message passes', () => {
    const result = SingleConstraintResult.safeParse({
      type: 'min_confidence',
      passed: false,
      expected: 0.8,
      actual: 0.62,
      message: 'Confidence too low',
    })
    expect(result.success).toBe(true)
  })
})

describe('ConstraintResult', () => {
  it('valid result with passed=true passes', () => {
    const result = ConstraintResult.safeParse({
      passed: true,
      results: [
        { type: 'max_latency_ms', passed: true, expected: 5000, actual: 2340 },
      ],
      evaluated_at: '2026-02-18T12:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('valid result with passed=false passes', () => {
    const result = ConstraintResult.safeParse({
      passed: false,
      results: [
        { type: 'min_confidence', passed: false, expected: 0.8, actual: 0.62 },
      ],
      evaluated_at: '2026-02-18T12:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('empty results array passes', () => {
    const result = ConstraintResult.safeParse({
      passed: true,
      results: [],
      evaluated_at: '2026-02-18T12:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('evaluated_at must be datetime', () => {
    const result = ConstraintResult.safeParse({
      passed: true,
      results: [],
      evaluated_at: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })
})

describe('ConstraintDefinitions', () => {
  it('array of definitions passes', () => {
    const result = ConstraintDefinitions.safeParse([
      { type: 'max_latency_ms', value: 5000 },
      { type: 'min_confidence', value: 0.8 },
    ])
    expect(result.success).toBe(true)
  })

  it('empty array passes', () => {
    const result = ConstraintDefinitions.safeParse([])
    expect(result.success).toBe(true)
  })
})
