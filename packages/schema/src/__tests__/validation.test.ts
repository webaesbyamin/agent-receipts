import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validate, formatZodError, createErrorResponse } from '../validation'

describe('validate', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  })

  it('returns success with parsed data for valid input', () => {
    const result = validate(schema, { name: 'Alice', age: 30 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'Alice', age: 30 })
    }
  })

  it('returns error response for invalid input', () => {
    const result = validate(schema, { name: '', age: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.error.status).toBe(400)
      expect(result.error.error.message).toContain('name')
    }
  })
})

describe('formatZodError', () => {
  it('formats single error', () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({ name: 123 })
    if (!result.success) {
      const message = formatZodError(result.error)
      expect(message).toContain('name')
    }
  })

  it('formats multiple errors joined by "; "', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })
    const result = schema.safeParse({ name: 123, age: 'not a number' })
    if (!result.success) {
      const message = formatZodError(result.error)
      expect(message).toContain('; ')
      expect(message).toContain('name')
      expect(message).toContain('age')
    }
  })
})

describe('createErrorResponse', () => {
  it('creates correct structure', () => {
    const response = createErrorResponse('UNAUTHORIZED', 'Invalid API key', 401)
    expect(response).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
        status: 401,
      },
    })
  })
})
