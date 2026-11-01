import { test as base, expect, type Page } from '@playwright/test'

/**
 * A page that can reach a protected Vercel preview: the OIDC token goes only to
 * the site's own origin, and Vercel's preview toolbar (vercel.live) is blocked.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin
    const token = process.env.VERCEL_OIDC_TOKEN
    await page.route('**/*', (route) => {
      const url = route.request().url()
      if (url.includes('vercel.live')) return route.abort('blockedbyclient')
      if (token && url.startsWith(origin)) return route.continue({ headers: { ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': token } })
      return route.continue()
    })
    await use(page)
  },
})

export { expect }

/** Headers for direct requests to the site (link checks). */
export function siteHeaders(): Record<string, string> {
  const token = process.env.VERCEL_OIDC_TOKEN
  return token ? { 'x-vercel-trusted-oidc-idp-token': token } : {}
}

/** The big signature stamp and the one in the edit bar. */
export const bigStamp = (page: Page) => page.locator('#signature [data-stamp]')
export const miniStamp = (page: Page) => page.locator('#editbar [data-stamp]')

/** Widths the layout must hold at. */
export const WIDTHS = [360, 390, 430, 768, 1024, 1280, 1440, 1920]
