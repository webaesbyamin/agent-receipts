import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const read = (f: string) => readFileSync(join(root, f), 'utf8')

describe('pinned versions match the package (MCP Registry, Glama, server)', () => {
  const version = JSON.parse(read('packages/mcp-server/package.json')).version as string

  it('server.ts reports the package version', () => {
    expect(read('packages/mcp-server/src/server.ts')).toContain(`version: '${version}'`)
  })

  it('server.json (MCP Registry) lists the package version', () => {
    const j = JSON.parse(read('server.json'))
    expect(j.version).toBe(version)
    expect(j.packages[0].version).toBe(version)
  })

  it('the Dockerfile Glama builds installs the package version', () => {
    expect(read('Dockerfile')).toContain(`@agent-receipts/mcp-server@${version}`)
  })
})
