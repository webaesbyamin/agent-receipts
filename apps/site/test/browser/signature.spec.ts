import { test, expect, bigStamp, miniStamp } from './fixtures'

test.describe('the page signature', () => {
  test('VERIFIED on load, VOID after one word changes, VERIFIED again after restore', async ({ page }) => {
    await page.goto('/')
    const stamp = bigStamp(page)
    await expect(stamp).toHaveAttribute('data-state', 'ok')
    await expect(stamp.locator('[data-stamp-word]')).toHaveText('Verified')
    const hash = await page.locator('#sig-hash').textContent()

    // Try to fake it: the hero button turns editing on, the edit bar appears
    await page.locator('.hero [data-fake]').click()
    await expect(page.locator('#editbar')).toBeVisible()
    await expect(page.locator('body')).toHaveClass(/editing/)
    const h1 = page.locator('h1[data-signed]')
    await expect(h1).toHaveAttribute('contenteditable', 'true')

    // Change one word
    await h1.evaluate((el) => {
      const range = document.createRange()
      const text = el.querySelectorAll('.ln')[1]!.firstChild!
      const at = text.textContent!.indexOf('done')
      range.setStart(text, at); range.setEnd(text, at + 4)
      const sel = getSelection()!; sel.removeAllRanges(); sel.addRange(range)
    })
    await page.keyboard.type('perfect')
    await expect(stamp).toHaveAttribute('data-state', 'void')
    await expect(stamp.locator('[data-stamp-word]')).toHaveText('Void')
    await expect(miniStamp(page)).toHaveAttribute('data-state', 'void')
    await expect(page.locator('#sig-hash')).not.toHaveText(hash!)

    // Restore
    await page.locator('#editbar [data-restore]').click()
    await expect(stamp).toHaveAttribute('data-state', 'ok')
    await expect(miniStamp(page)).toHaveAttribute('data-state', 'ok')
    await expect(page.locator('#sig-hash')).toHaveText(hash!)
    await expect(h1).toContainText('says it’s done.')

    // Stop editing
    await page.locator('#editbar [data-fake]').click()
    await expect(page.locator('#editbar')).toBeHidden()
    await expect(h1).not.toHaveAttribute('contenteditable', 'true')
  })

  test('any signed text counts, including the new automatic-receipts block', async ({ page }) => {
    await page.goto('/')
    await expect(bigStamp(page)).toHaveAttribute('data-state', 'ok')
    await page.locator('#signature [data-fake]').click()
    const p = page.locator('#install p[data-signed]', { hasText: 'every action, automatically' })
    await p.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' x')
    await expect(bigStamp(page)).toHaveAttribute('data-state', 'void')
    await page.locator('#signature [data-restore]').click()
    await expect(bigStamp(page)).toHaveAttribute('data-state', 'ok')
  })

  test('says whether the embedded key is the one the site publishes', async ({ page, baseURL }) => {
    await page.goto('/')
    const published = page.locator('#sig-published')
    await expect(published).not.toHaveText('checking')
    // A local build signs with a throwaway test key; a deployment with the site's own key
    const local = new URL(baseURL!).hostname === '127.0.0.1'
    await expect(published).toHaveText(local ? 'no: this build used a local test key' : 'yes, the key matches')
  })
})

test.describe('the real-receipt demo', () => {
  test('verified as signed, not verified after an edit, verified again after reset', async ({ page }) => {
    await page.goto('/')
    const status = page.locator('#status')
    await expect(status).toHaveText('Verified, signed by Webaes')
    await expect(status).toHaveAttribute('data-state', 'ok')
    // The receipt is rendered in a shadow root next to the editor
    await expect(page.locator('#receipt-host')).toContainText('Webaes')

    await page.locator('#summary').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' (edited)')
    await expect(status).toHaveText('Not verified: this receipt was changed after it was signed')
    await expect(status).toHaveAttribute('data-state', 'bad')

    await page.locator('#reset').click()
    await expect(status).toHaveText('Verified, signed by Webaes')
  })
})
