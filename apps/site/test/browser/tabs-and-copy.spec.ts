import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

/** Click every visible Copy button and check the clipboard holds exactly that block's code. */
async function checkCopyButtons(page: Page, scope: string) {
  const buttons = page.locator(`${scope} [data-copy]`).filter({ visible: true })
  const n = await buttons.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i)
    const code = (await b.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " code ")][1]').locator('code').textContent())!
    await b.click()
    await expect(b).toHaveText('Copied')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code)
  }
  return n
}

test.describe('home: agent tabs and copy buttons', () => {
  test('each agent tab shows its own panel, by click and by arrow keys', async ({ page }) => {
    await page.goto('/#install')
    const tabs = page.locator('[data-tabs=agent] [role=tab]')
    await expect(tabs).toHaveCount(3)
    for (const id of ['cursor', 'sdk', 'cc']) {
      await page.locator(`#tab-${id}`).click()
      await expect(page.locator(`#tab-${id}`)).toHaveAttribute('aria-selected', 'true')
      for (const other of ['cc', 'cursor', 'sdk']) await expect(page.locator(`#panel-${other}`)).toBeVisible({ visible: other === id })
    }
    await page.locator('#tab-cc').focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#tab-cursor')).toBeFocused()
    await expect(page.locator('#panel-cursor')).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('#tab-sdk')).toBeFocused()
  })

  test('every Copy button on the page copies its own code, in every tab', async ({ page }) => {
    await page.goto('/')
    let total = await checkCopyButtons(page, 'main')
    for (const id of ['cursor', 'sdk']) {
      await page.locator(`#tab-${id}`).click()
      total += await checkCopyButtons(page, `#panel-${id}`)
    }
    expect(total).toBeGreaterThanOrEqual(8)
  })
})

test.describe('/install: OS tabs and copy buttons', () => {
  for (const os of ['mac', 'windows', 'linux']) {
    test(`#${os} opens the ${os} steps, and every Copy button there works`, async ({ page }) => {
      await page.goto(`/install#${os}`)
      await expect(page.locator(`#tab-${os}`)).toHaveAttribute('aria-selected', 'true')
      for (const other of ['mac', 'windows', 'linux']) await expect(page.locator(`#panel-${other}`)).toBeVisible({ visible: other === os })
      await checkCopyButtons(page, `#panel-${os}`)
    })
  }

  test('clicking a tab updates the URL; arrow keys move between tabs', async ({ page }) => {
    await page.goto('/install#mac')
    await page.locator('#tab-linux').click()
    await expect(page).toHaveURL(/#linux$/)
    await expect(page.locator('#panel-linux')).toBeVisible()
    await page.locator('#tab-linux').focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#tab-mac')).toBeFocused()
    await expect(page.locator('#panel-mac')).toBeVisible()
  })

  test('install links point at the visitor’s OS', async ({ page }) => {
    await page.goto('/')
    // Playwright's Desktop Chrome reports Windows
    const href = await page.locator('header [data-install-link]').getAttribute('href')
    expect(href).toMatch(/^\/install#(mac|windows|linux)$/)
  })
})
