import { test, expect, siteHeaders } from './fixtures'

// External links are checked too unless CHECK_EXTERNAL_LINKS=0 (e.g. offline).
const EXTERNAL = process.env.CHECK_EXTERNAL_LINKS !== '0'

for (const path of ['/', '/install']) {
  test(`every link on ${path} works`, async ({ page, request, baseURL }) => {
    await page.goto(path)
    const origin = new URL(baseURL!).origin
    const hrefs = [...new Set(await page.locator('a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href)))]
    expect(hrefs.length).toBeGreaterThan(5)
    const broken: string[] = []
    for (const href of hrefs) {
      const url = new URL(href)
      if (url.protocol === 'mailto:') continue
      if (url.origin === origin) {
        const res = await request.get(url.pathname + url.search, { headers: siteHeaders() })
        if (res.status() !== 200) { broken.push(`${href} → ${res.status()}`); continue }
        if (url.hash) {
          // The anchor must exist on the target page
          const id = decodeURIComponent(url.hash.slice(1))
          const body = await res.text()
          if (!body.includes(`id="${id}"`)) broken.push(`${href} → no #${id}`)
        }
      } else if (EXTERNAL) {
        try {
          const res = await request.get(href, { timeout: 20_000, maxRedirects: 5 })
          if (res.status() >= 400 && res.status() !== 403 && res.status() !== 429) broken.push(`${href} → ${res.status()}`)
        } catch (e) {
          broken.push(`${href} → ${(e as Error).message.split('\n')[0]}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
}

test('the published site key, robots and sitemap are served', async ({ request }) => {
  for (const path of ['/.well-known/agent-receipts-site.json', '/robots.txt', '/sitemap.xml', '/og.png']) {
    const res = await request.get(path, { headers: siteHeaders() })
    expect(res.status(), path).toBe(200)
  }
  const key = await (await request.get('/.well-known/agent-receipts-site.json', { headers: siteHeaders() })).json()
  expect(key.public_key).toMatch(/^[0-9a-f]{64}$/)
})
