import { describe, it, expect } from 'vitest'
import { whenUnlocked } from '../files.js'

const locked = (code: string) => Object.assign(new Error(code), { code })

describe('whenUnlocked (Windows: a file another program has open)', () => {
  it('retries while the file is busy, then succeeds', async () => {
    let calls = 0
    const result = await whenUnlocked(async () => {
      calls++
      if (calls < 3) throw locked(calls === 1 ? 'EBUSY' : 'EPERM')
      return 'moved'
    }, 5, 1)
    expect(result).toBe('moved')
    expect(calls).toBe(3)
  })

  it('gives up after the last try', async () => {
    let calls = 0
    await expect(whenUnlocked(async () => { calls++; throw locked('EBUSY') }, 3, 1)).rejects.toThrow('EBUSY')
    expect(calls).toBe(3)
  })

  it('does not retry other errors', async () => {
    let calls = 0
    await expect(whenUnlocked(async () => { calls++; throw locked('ENOENT') }, 5, 1)).rejects.toThrow('ENOENT')
    expect(calls).toBe(1)
  })
})
