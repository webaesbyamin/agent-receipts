// Every page's <title>, og:title and twitter:title: "|" is the only separator
// (no ":", "·" or "—"), at most 60 characters. Runs on the output of `pnpm build`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'

const app = join(dirname(fileURLToPath(import.meta.url)), '..', '.next', 'server', 'app')
const pages = readdirSync(app).filter((f) => f.endsWith('.html') && f !== '_not-found.html')

test('the build has the pages', () => assert.deepEqual(pages.sort(), ['index.html', 'install.html']))

for (const page of pages) {
  test(`${page}: titles use only "|" and fit in 60 characters`, () => {
    const { document } = parseHTML(readFileSync(join(app, page), 'utf-8'))
    const titles = [
      ['title', document.querySelector('title')?.textContent],
      ['og:title', document.querySelector('meta[property="og:title"]')?.getAttribute('content')],
      ['twitter:title', document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')],
    ]
    for (const [kind, t] of titles) {
      assert.ok(t, `${kind} is missing`)
      assert.doesNotMatch(t, /[:·—]/, `${kind} "${t}" uses a separator other than "|"`)
      assert.ok(t.length <= 60, `${kind} "${t}" is ${t.length} characters`)
    }
    assert.equal(titles[1][1], titles[0][1], 'og:title matches the title')
  })
}
