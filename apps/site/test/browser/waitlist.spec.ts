import { test, expect } from './fixtures'
import type { Page, Route } from '@playwright/test'

// The waitlist API is mocked here: no request reaches Buttondown.
async function submit(page: Page, reply: (route: Route) => Promise<void>) {
  const sent: unknown[] = []
  await page.route('**/api/waitlist', async (route) => { sent.push(route.request().postDataJSON()); await reply(route) })
  await page.goto('/#stub')
  await page.locator('#stub-email').fill('someone@example.com')
  await page.locator('input[name=role][value=agency]').check()
  await page.locator('input[name=pay][value=monthly]').check()
  await page.locator('#stub-worth').fill('49')
  await page.locator('#stub-use').fill('client deliverables')
  await page.locator('#stub-form button[type=submit]').click()
  return sent
}

test.describe('the early-access stub (mocked)', () => {
  test('new signup: the RECEIVED stamp, "check your email"', async ({ page }) => {
    const sent = await submit(page, (r) => r.fulfill({ json: { ok: true, status: 'created' } }))
    await expect(page.locator('#stub-done')).toBeVisible()
    await expect(page.locator('#stub-form')).toBeHidden()
    await expect(page.locator('#stub-done-sub')).toHaveText('check your email to confirm')
    await expect(page.locator('#stub-done')).toBeFocused()
    expect(sent[0]).toMatchObject({ email: 'someone@example.com', role: 'agency', pay: 'monthly', worth: '49', use: 'client deliverables', hp_token: '' })
  })

  test('already on the list', async ({ page }) => {
    await submit(page, (r) => r.fulfill({ json: { ok: true, status: 'existing' } }))
    await expect(page.locator('#stub-done-sub')).toHaveText('you’re already on the list')
  })

  test('an error from the server is shown, and the form stays', async ({ page }) => {
    await submit(page, (r) => r.fulfill({ status: 422, json: { error: 'That email doesn’t look right.' } }))
    await expect(page.locator('#stub-msg')).toHaveText('That email doesn’t look right.')
    await expect(page.locator('#stub-form')).toBeVisible()
    await expect(page.locator('#stub-form button[type=submit]')).toHaveText('Hand in the stub')
    await expect(page.locator('#stub-form button[type=submit]')).toBeEnabled()
  })

  test('the server can’t be reached', async ({ page }) => {
    await submit(page, (r) => r.abort('connectionrefused'))
    await expect(page.locator('#stub-msg')).toHaveText('Couldn’t reach the waitlist. Try again.')
  })

  test('a reply with no message', async ({ page }) => {
    await submit(page, (r) => r.fulfill({ status: 500, json: {} }))
    await expect(page.locator('#stub-msg')).toHaveText('Something went wrong. Try again.')
  })

  test('the browser stops an empty or invalid email before anything is sent', async ({ page }) => {
    let calls = 0
    await page.route('**/api/waitlist', (r) => { calls++; return r.fulfill({ json: { ok: true } }) })
    await page.goto('/#stub')
    await page.locator('#stub-form button[type=submit]').click()
    await page.locator('#stub-email').fill('not-an-email')
    await page.locator('#stub-form button[type=submit]').click()
    expect(calls).toBe(0)
    await expect(page.locator('#stub-form')).toBeVisible()
  })
})
