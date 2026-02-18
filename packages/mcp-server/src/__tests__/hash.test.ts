import { describe, it, expect } from 'vitest'
import { hashData } from '../hash.js'

describe('hashData', () => {
  it('returns sha256:<hex> format', () => {
    const result = hashData('hello')
    expect(result).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('is deterministic for same input', () => {
    const a = hashData({ foo: 'bar' })
    const b = hashData({ foo: 'bar' })
    expect(a).toBe(b)
  })

  it('produces different hashes for different input', () => {
    const a = hashData('hello')
    const b = hashData('world')
    expect(a).not.toBe(b)
  })

  it('handles nested objects with deterministic key order', () => {
    const a = hashData({ b: 2, a: { d: 4, c: 3 } })
    const b = hashData({ a: { c: 3, d: 4 }, b: 2 })
    expect(a).toBe(b)
  })

  it('handles arrays', () => {
    const result = hashData([1, 2, 3])
    expect(result).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('handles arrays with nested objects (deep canonical)', () => {
    const a = hashData([{ b: 2, a: 1 }])
    const b = hashData([{ a: 1, b: 2 }])
    expect(a).toBe(b)
  })

  it('handles null values', () => {
    const result = hashData(null)
    expect(result).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('handles undefined (serializes as null)', () => {
    const result = hashData(undefined)
    expect(result).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('handles strings', () => {
    const result = hashData('test string')
    expect(result).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('handles numbers', () => {
    const result = hashData(42)
    expect(result).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('handles booleans', () => {
    const result = hashData(true)
    expect(result).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('handles empty objects', () => {
    const result = hashData({})
    expect(result).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('handles deeply nested structures', () => {
    const a = hashData({ l1: { l2: { l3: { z: 1, a: 2 } } } })
    const b = hashData({ l1: { l2: { l3: { a: 2, z: 1 } } } })
    expect(a).toBe(b)
  })

  it('preserves null vs missing keys distinction', () => {
    const a = hashData({ key: null })
    const b = hashData({})
    expect(a).not.toBe(b)
  })
})
