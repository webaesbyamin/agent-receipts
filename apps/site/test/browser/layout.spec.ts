import { test, expect, WIDTHS } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * Overlap sweep: no sideways scroll, nothing wider than the screen, and no two
 * pieces of text drawn on top of each other. Text boxes are measured from the
 * text itself (Range rects), so margin notes and rotated stamps count as drawn.
 */
async function sweep(page: Page) {
  // Let the stamp's thump (a brief scale-up) finish, so it's measured at rest
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
  return page.evaluate(() => {
    const SEL = 'h1, h2, h3, p, li, dt, dd, button, legend, label > span, pre, .item, .stamp, .mnote, nav a, input, textarea, .tabs [role=tab]'
    const vw = document.documentElement.clientWidth
    // checkVisibility also leaves out the contents of closed <details> (content-visibility)
    const visible = (el: Element) => !el.closest('[hidden], .sr-only, .hp') && el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }) && el.getClientRects().length > 0
    const boxOf = (el: Element) => {
      if (el.matches('input, textarea, button, .stamp, pre, [role=tab]')) return el.getBoundingClientRect()
      // Text inside a code block scrolls within the block; the block itself is measured as a box
      const rects: DOMRect[] = []
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (n.parentElement?.closest('pre') && !el.matches('pre')) continue
        const r = document.createRange(); r.selectNodeContents(n)
        rects.push(...[...r.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5))
      }
      if (!rects.length) return null
      return { left: Math.min(...rects.map((x) => x.left)), right: Math.max(...rects.map((x) => x.right)), top: Math.min(...rects.map((x) => x.top)), bottom: Math.max(...rects.map((x) => x.bottom)) }
    }
    const els = [...document.querySelectorAll(SEL)].filter(visible)
    const boxes = els.map((el) => ({ el, b: boxOf(el) })).filter((x) => x.b) as Array<{ el: Element; b: { left: number; right: number; top: number; bottom: number } }>
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`
    const tooWide = boxes.filter(({ el, b }) => b.right > vw + 1 && !el.closest('pre')).map(({ el }) => name(el))
    const overlaps: string[] = []
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, c = boxes[j]!
      if (a.el.contains(c.el) || c.el.contains(a.el)) continue
      const w = Math.min(a.b.right, c.b.right) - Math.max(a.b.left, c.b.left)
      const h = Math.min(a.b.bottom, c.b.bottom) - Math.max(a.b.top, c.b.top)
      if (w > 2 && h > 2) overlaps.push(`${name(a.el)} × ${name(c.el)} (${Math.round(w)}×${Math.round(h)})`)
    }
    return { scroll: document.documentElement.scrollWidth - vw, tooWide, overlaps: overlaps.slice(0, 10) }
  })
}

for (const path of ['/', '/install']) {
  for (const width of WIDTHS) {
    test(`${path} at ${width}px: no overlaps, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      if (path === '/') await expect(page.locator('#signature [data-stamp]')).toHaveAttribute('data-state', 'ok')
      await page.evaluate(() => document.fonts.ready)
      const r = await sweep(page)
      expect(r.scroll, 'sideways scroll').toBeLessThanOrEqual(0)
      expect(r.tooWide, 'wider than the screen').toEqual([])
      expect(r.overlaps, 'text drawn over other text').toEqual([])
    })
  }
}

for (const width of [360, 1024, 1920]) {
  test(`/install at ${width}px with every troubleshooting answer open: no overlaps`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/install')
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
    const r = await sweep(page)
    expect(r.scroll).toBeLessThanOrEqual(0)
    expect(r.tooWide).toEqual([])
    expect(r.overlaps).toEqual([])
  })
}

for (const width of [360, 390, 1280]) {
  test(`/ while faking the page at ${width}px: a longer word wraps, the stamp says VOID, nothing overflows`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.locator('#signature [data-stamp]')).toHaveAttribute('data-state', 'ok')
    await page.locator('.hero [data-fake]').click()
    await page.locator('h1[data-signed]').evaluate((el) => {
      const t = el.querySelectorAll('.ln')[1]!.firstChild!; const at = t.textContent!.indexOf('done')
      const r = document.createRange(); r.setStart(t, at); r.setEnd(t, at + 4); const s = getSelection()!; s.removeAllRanges(); s.addRange(r)
    })
    await page.keyboard.type('PERFECT.')
    await expect(page.locator('#signature [data-stamp]')).toHaveAttribute('data-state', 'void')
    const r = await sweep(page)
    expect(r.scroll).toBeLessThanOrEqual(0)
    expect(r.tooWide).toEqual([])
  })
}
