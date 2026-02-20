import { describe, it, expect } from 'vitest'
import {
  RubricCriterion,
  Rubric,
  CriterionResult,
  JudgmentResult,
} from '../index'

describe('RubricCriterion', () => {
  it('valid criterion passes', () => {
    const result = RubricCriterion.safeParse({
      name: 'accuracy',
      description: 'The output is factually correct',
      weight: 0.4,
    })
    expect(result.success).toBe(true)
  })

  it('empty name fails', () => {
    const result = RubricCriterion.safeParse({
      name: '',
      description: 'Test',
      weight: 0.5,
    })
    expect(result.success).toBe(false)
  })

  it('weight must be 0-1', () => {
    const over = RubricCriterion.safeParse({
      name: 'test', description: 'test', weight: 1.5,
    })
    expect(over.success).toBe(false)

    const under = RubricCriterion.safeParse({
      name: 'test', description: 'test', weight: -0.1,
    })
    expect(under.success).toBe(false)

    const valid = RubricCriterion.safeParse({
      name: 'test', description: 'test', weight: 0,
    })
    expect(valid.success).toBe(true)
  })

  it('passing_threshold optional', () => {
    const without = RubricCriterion.safeParse({
      name: 'test', description: 'test', weight: 0.5,
    })
    expect(without.success).toBe(true)

    const with_ = RubricCriterion.safeParse({
      name: 'test', description: 'test', weight: 0.5, passing_threshold: 0.7,
    })
    expect(with_.success).toBe(true)
  })

  it('examples optional', () => {
    const result = RubricCriterion.safeParse({
      name: 'test',
      description: 'test',
      weight: 0.5,
      examples: {
        good: ['Good answer'],
        bad: ['Bad answer'],
      },
    })
    expect(result.success).toBe(true)
  })
})

describe('Rubric', () => {
  it('valid rubric passes', () => {
    const result = Rubric.safeParse({
      criteria: [
        { name: 'accuracy', description: 'Correct output', weight: 0.5 },
        { name: 'safety', description: 'Safe output', weight: 0.5 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('empty criteria array fails (min 1)', () => {
    const result = Rubric.safeParse({ criteria: [] })
    expect(result.success).toBe(false)
  })

  it('defaults applied (version, passing_threshold, require_all)', () => {
    const result = Rubric.parse({
      criteria: [{ name: 'test', description: 'test', weight: 1.0 }],
    })
    expect(result.version).toBe('1.0')
    expect(result.passing_threshold).toBe(0.7)
    expect(result.require_all).toBe(false)
  })

  it('passing_threshold must be 0-1', () => {
    const result = Rubric.safeParse({
      criteria: [{ name: 'test', description: 'test', weight: 1.0 }],
      passing_threshold: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('CriterionResult', () => {
  it('valid result passes', () => {
    const result = CriterionResult.safeParse({
      criterion: 'accuracy',
      score: 0.92,
      passed: true,
      reasoning: 'Output was accurate',
    })
    expect(result.success).toBe(true)
  })

  it('score must be 0-1', () => {
    const over = CriterionResult.safeParse({
      criterion: 'test', score: 1.5, passed: true, reasoning: 'test',
    })
    expect(over.success).toBe(false)

    const under = CriterionResult.safeParse({
      criterion: 'test', score: -0.1, passed: false, reasoning: 'test',
    })
    expect(under.success).toBe(false)
  })
})

describe('JudgmentResult', () => {
  it('valid result passes', () => {
    const result = JudgmentResult.safeParse({
      verdict: 'pass',
      score: 0.91,
      criteria_results: [
        { criterion: 'accuracy', score: 0.95, passed: true, reasoning: 'Correct' },
      ],
      overall_reasoning: 'Good output',
      rubric_version: '1.0',
    })
    expect(result.success).toBe(true)
  })

  it('verdict must be pass/fail/partial', () => {
    const invalid = JudgmentResult.safeParse({
      verdict: 'maybe',
      score: 0.5,
      criteria_results: [],
      overall_reasoning: 'test',
      rubric_version: '1.0',
    })
    expect(invalid.success).toBe(false)
  })

  it('score must be 0-1', () => {
    const result = JudgmentResult.safeParse({
      verdict: 'pass',
      score: 1.5,
      criteria_results: [],
      overall_reasoning: 'test',
      rubric_version: '1.0',
    })
    expect(result.success).toBe(false)
  })
})
