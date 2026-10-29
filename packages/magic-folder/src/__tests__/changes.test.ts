import { describe, it, expect } from 'vitest'
import { wordChanges, fixedName } from '../changes.js'

describe('wordChanges', () => {
  it('lists each misspelled word as before → after', () => {
    expect(wordChanges('We beleive in carefull work and recieve feedback.', 'We believe in careful work and receive feedback.'))
      .toEqual(['beleive → believe', 'carefull → careful', 'recieve → receive'])
  })

  it('gives punctuation-only changes a few words of context', () => {
    expect(wordChanges('within one business day\nThanks', 'within one business day.\nThanks'))
      .toEqual(['one business day → one business day.'])
    expect(wordChanges('Hello world', 'Hello, world')).toEqual(['Hello world → Hello, world'])
  })

  it('gives added and removed words context too', () => {
    expect(wordChanges('reply to every message', 'reply to every single message')).toEqual(['to every → to every single'])
    expect(wordChanges('the the cat', 'the cat')).toEqual(['the the → the'])
  })

  it('finds nothing when only whitespace differs', () => {
    expect(wordChanges('a  b\r\nc', 'a b\nc')).toEqual([])
    expect(wordChanges('same', 'same')).toEqual([])
  })

  it('compares changed lines only, across many lines', () => {
    const before = Array.from({ length: 300 }, (_, i) => `line ${i} is fine`)
    const after = [...before]
    after[150] = 'line 150 is fien'
    expect(wordChanges(before.join('\n'), after.join('\n'))).toEqual(['fine → fien'])
  })
})

describe('fixedName', () => {
  it('adds " (fixed)" before the extension', () => {
    expect(fixedName('notes.txt')).toBe('notes (fixed).txt')
    expect(fixedName('README')).toBe('README (fixed)')
  })
})
