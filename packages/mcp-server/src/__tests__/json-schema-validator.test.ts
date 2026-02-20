import { describe, it, expect } from 'vitest'
import { validateJsonSchema } from '../engine/json-schema-validator.js'

describe('validateJsonSchema', () => {
  describe('type', () => {
    it('validates string', () => {
      const errors = validateJsonSchema('hello', { type: 'string' })
      expect(errors).toEqual([])
    })

    it('validates number', () => {
      const errors = validateJsonSchema(42, { type: 'number' })
      expect(errors).toEqual([])
    })

    it('validates integer (rejects float)', () => {
      expect(validateJsonSchema(42, { type: 'integer' })).toEqual([])
      expect(validateJsonSchema(3.14, { type: 'integer' }).length).toBeGreaterThan(0)
    })

    it('validates boolean', () => {
      const errors = validateJsonSchema(true, { type: 'boolean' })
      expect(errors).toEqual([])
    })

    it('validates object', () => {
      const errors = validateJsonSchema({ a: 1 }, { type: 'object' })
      expect(errors).toEqual([])
    })

    it('validates array', () => {
      const errors = validateJsonSchema([1, 2], { type: 'array' })
      expect(errors).toEqual([])
    })

    it('validates null', () => {
      const errors = validateJsonSchema(null, { type: 'null' })
      expect(errors).toEqual([])
    })

    it('rejects wrong type', () => {
      const errors = validateJsonSchema('hello', { type: 'number' })
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('expected type number')
    })
  })

  describe('required', () => {
    it('passes when all present', () => {
      const errors = validateJsonSchema(
        { name: 'test', count: 5 },
        { type: 'object', required: ['name', 'count'] },
      )
      expect(errors).toEqual([])
    })

    it('fails when missing', () => {
      const errors = validateJsonSchema(
        { name: 'test' },
        { type: 'object', required: ['name', 'count'] },
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('count')
    })
  })

  describe('properties', () => {
    it('validates nested object', () => {
      const errors = validateJsonSchema(
        { name: 'test', count: 5 },
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
            count: { type: 'number' },
          },
        },
      )
      expect(errors).toEqual([])
    })
  })

  describe('items', () => {
    it('validates array items', () => {
      const valid = validateJsonSchema([1, 2, 3], { type: 'array', items: { type: 'number' } })
      expect(valid).toEqual([])

      const invalid = validateJsonSchema([1, 'two', 3], { type: 'array', items: { type: 'number' } })
      expect(invalid.length).toBeGreaterThan(0)
    })
  })

  describe('minLength/maxLength', () => {
    it('validates string length', () => {
      expect(validateJsonSchema('abc', { type: 'string', minLength: 2, maxLength: 5 })).toEqual([])
      expect(validateJsonSchema('a', { type: 'string', minLength: 2 }).length).toBeGreaterThan(0)
      expect(validateJsonSchema('abcdef', { type: 'string', maxLength: 5 }).length).toBeGreaterThan(0)
    })
  })

  describe('minimum/maximum', () => {
    it('validates number range', () => {
      expect(validateJsonSchema(5, { type: 'number', minimum: 0, maximum: 10 })).toEqual([])
      expect(validateJsonSchema(-1, { type: 'number', minimum: 0 }).length).toBeGreaterThan(0)
      expect(validateJsonSchema(11, { type: 'number', maximum: 10 }).length).toBeGreaterThan(0)
    })
  })

  describe('enum', () => {
    it('accepts valid value', () => {
      const errors = validateJsonSchema('USD', { enum: ['USD', 'EUR', 'GBP'] })
      expect(errors).toEqual([])
    })

    it('rejects invalid value', () => {
      const errors = validateJsonSchema('JPY', { enum: ['USD', 'EUR', 'GBP'] })
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('not in enum')
    })
  })

  describe('pattern', () => {
    it('matches regex', () => {
      expect(validateJsonSchema('abc123', { type: 'string', pattern: '^[a-z]+\\d+$' })).toEqual([])
      expect(validateJsonSchema('ABC', { type: 'string', pattern: '^[a-z]+$' }).length).toBeGreaterThan(0)
    })
  })

  describe('minItems/maxItems', () => {
    it('validates array length', () => {
      expect(validateJsonSchema([1, 2, 3], { type: 'array', minItems: 2, maxItems: 5 })).toEqual([])
      expect(validateJsonSchema([1], { type: 'array', minItems: 2 }).length).toBeGreaterThan(0)
      expect(validateJsonSchema([1, 2, 3, 4, 5, 6], { type: 'array', maxItems: 5 }).length).toBeGreaterThan(0)
    })
  })

  describe('additionalProperties', () => {
    it('false rejects extra keys', () => {
      const errors = validateJsonSchema(
        { name: 'test', extra: 'field' },
        {
          type: 'object',
          properties: { name: { type: 'string' } },
          additionalProperties: false,
        },
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('additional property')
    })
  })

  it('nested validation: deep objects', () => {
    const errors = validateJsonSchema(
      { user: { name: 'Alice', age: 30 } },
      {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
              age: { type: 'number', minimum: 0 },
            },
          },
        },
      },
    )
    expect(errors).toEqual([])
  })

  it('multiple errors: returns all failures', () => {
    const errors = validateJsonSchema(
      { name: 123, count: 'not-a-number' },
      {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
        },
      },
    )
    expect(errors.length).toBe(2)
  })

  it('empty schema: everything passes', () => {
    expect(validateJsonSchema('hello', {})).toEqual([])
    expect(validateJsonSchema(42, {})).toEqual([])
    expect(validateJsonSchema(null, {})).toEqual([])
    expect(validateJsonSchema({ a: 1 }, {})).toEqual([])
  })
})
