import { describe, it, expect } from 'vitest'
import { cleanSummary, dropNoOpChanges } from '../tidy.js'

describe('cleanSummary', () => {
  const job = '/Users/a/Magic Folder/.magic/jobs/2026-10-29 1500 note'

  it('strips input/ and output/ prefixes', () => {
    expect(cleanSummary('Fixed the input/webaes-test-note.txt file, saving it as output/webaes-test-note (fixed).txt. Created output/changes.md.', []))
      .toBe('Fixed the webaes-test-note.txt file, saving it as webaes-test-note (fixed).txt. Created changes.md.')
  })

  it('strips absolute job paths, including the realpath form', () => {
    expect(cleanSummary(`Read ${job}/input/a.txt and /private${job}/output/b.txt in ${job}/.`, [job, `/private${job}`]))
      .toBe('Read a.txt and b.txt in .')
  })

  it('strips .magic/jobs paths it was not told about', () => {
    expect(cleanSummary('Wrote "/tmp/x/.magic/jobs/abc/output/b.txt".', [])).toBe('Wrote "b.txt".')
  })

  it('leaves ordinary words alone', () => {
    expect(cleanSummary('The output was fine. See docs/input/x and the input file.', [])).toBe('The output was fine. See docs/input/x and the input file.')
  })
})

describe('dropNoOpChanges', () => {
  it('drops identical lines and the format placeholder, keeps real changes', () => {
    expect(dropNoOpChanges('- before -> after\n- recieve -> receive\n- "two days." → "two days."\n- "two days" -> "two days."\n'))
      .toBe('- recieve -> receive\n- "two days" -> "two days."\n')
  })

  it('sees past a "before -> after:" label the model echoed', () => {
    expect(dropNoOpChanges('- before -> after: grate → great\n- before -> after: day → day\n'))
      .toBe('- before -> after: grate → great\n')
  })

  it('handles numbered lists, bold, backticks and CRLF', () => {
    expect(dropNoOpChanges('# Changes\r\n1. **teh** -> **the**\r\n2. `same` => `same`\r\n'))
      .toBe('# Changes\r\n1. **teh** -> **the**\r\n')
  })
})
