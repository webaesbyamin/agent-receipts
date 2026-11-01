import { test, expect } from './fixtures'

test.describe('automatic receipts (hooks and proxy) on the home page', () => {
  test('the block shows both commands, signed, with its note', async ({ page }) => {
    await page.goto('/#install')
    const block = page.locator('#install .mini', { hasText: 'every action, automatically' })
    await expect(block).toBeVisible()
    await expect(block.locator('code').nth(0)).toHaveText('npx @agent-receipts/cli hooks install')
    await expect(block.locator('code').nth(1)).toHaveText('claude mcp add fs-receipted -- npx -y @agent-receipts/cli proxy --name fs -- npx -y @modelcontextprotocol/server-filesystem ~/Documents')
    await expect(block.locator('p[data-signed]')).toHaveCount(2)
    await expect(page.locator('#install .mnote', { hasText: 'hashes only' })).toBeVisible()
  })

  test('the FAQ answers it, in the page and in the structured data', async ({ page }) => {
    await page.goto('/')
    const q = 'Can it record what my coding agent does, automatically?'
    await expect(page.locator('#fine-print strong', { hasText: q })).toBeVisible()
    await expect(page.locator('#fine-print li', { hasText: q })).toContainText('claude -p')
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(ld.join('')).toContain(q)
  })

  test('/install has no --allow-scripts and names Node 22.16', async ({ page }) => {
    await page.goto('/install')
    const text = await page.locator('main').textContent()
    expect(text).not.toContain('allow-scripts')
    expect(text).toContain('22.16')
  })
})
