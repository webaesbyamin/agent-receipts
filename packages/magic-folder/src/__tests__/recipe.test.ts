import { describe, it, expect } from 'vitest'
import { parseRecipe, RecipeError, RECIPE_DEFAULTS } from '../recipe.js'
import { STARTER_RECIPES } from '../starter.js'

describe('parseRecipe', () => {
  it('reads front matter and the instruction', () => {
    const r = parseRecipe('Fix typos', `---
credits: 2
tools: Read, Write, Edit
max_minutes: 3
max_cost_usd: 0.25
needs_approval: yes
model: claude-test
---
Fix the typos.
Keep the tone.
`)
    expect(r).toEqual({
      name: 'Fix typos',
      instruction: 'Fix the typos.\nKeep the tone.',
      credits: 2,
      tools: ['Read', 'Write', 'Edit'],
      maxMinutes: 3,
      maxCostUsd: 0.25,
      needsApproval: true,
      changesReport: false,
      model: 'claude-test',
    })
  })

  it('uses defaults when there is no front matter', () => {
    const r = parseRecipe('Plain', 'Just do it.')
    expect(r.credits).toBe(RECIPE_DEFAULTS.credits)
    expect(r.tools).toEqual(['Read', 'Write'])
    expect(r.needsApproval).toBe(false)
    expect(r.instruction).toBe('Just do it.')
  })

  it('handles Windows line endings and a BOM', () => {
    const r = parseRecipe('Win', '﻿---\r\ncredits: 3\r\n---\r\nDo it.\r\n')
    expect(r.credits).toBe(3)
    expect(r.instruction).toBe('Do it.')
  })

  it('refuses tools outside the allow list (no shell, no web)', () => {
    expect(() => parseRecipe('Bad', '---\ntools: Read, Bash\n---\nx')).toThrow('Bash')
    expect(() => parseRecipe('Bad', '---\ntools: WebFetch\n---\nx')).toThrow('WebFetch')
  })

  it('refuses out-of-range numbers and bad booleans', () => {
    expect(() => parseRecipe('Bad', '---\ncredits: -1\n---\nx')).toThrow(RecipeError)
    expect(() => parseRecipe('Bad', '---\nmax_cost_usd: lots\n---\nx')).toThrow('max_cost_usd')
    expect(() => parseRecipe('Bad', '---\nneeds_approval: maybe\n---\nx')).toThrow('needs_approval')
  })

  it('refuses an empty instruction or unclosed front matter', () => {
    expect(() => parseRecipe('Empty', '---\ncredits: 1\n---\n   \n')).toThrow('no instruction')
    expect(() => parseRecipe('Open', '---\ncredits: 1\nDo it')).toThrow('not closed')
  })

  it('every starter recipe parses', () => {
    for (const [name, body] of Object.entries(STARTER_RECIPES)) {
      const r = parseRecipe(name, body)
      expect(r.instruction.length).toBeGreaterThan(50)
      expect(r.tools).not.toContain('Bash')
    }
    expect(parseRecipe('Draft a client email', STARTER_RECIPES['Draft a client email']!).needsApproval).toBe(true)
    expect(parseRecipe('Fix typos', STARTER_RECIPES['Fix typos']!).changesReport).toBe(true)
  })

  it('reads changes_report and rejects non-booleans', () => {
    expect(parseRecipe('X', '---\nchanges_report: true\n---\nx').changesReport).toBe(true)
    expect(() => parseRecipe('X', '---\nchanges_report: sometimes\n---\nx')).toThrow('changes_report must be true or false')
  })
})
