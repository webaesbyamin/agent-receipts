// Copies the built hook into the Claude Code plugin (plugins/agent-receipts)
// and writes its hooks.json, so the plugin always runs the same hook as the CLI.
import { copyFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { pluginHooksFile, HOOK_SCRIPT } = await import('../dist/plugin-hooks.mjs')
const pluginHooks = join(here, '..', '..', '..', 'plugins', 'agent-receipts', 'hooks')
mkdirSync(pluginHooks, { recursive: true })
copyFileSync(join(here, '..', 'dist', HOOK_SCRIPT), join(pluginHooks, HOOK_SCRIPT))
writeFileSync(join(pluginHooks, 'hooks.json'), JSON.stringify(pluginHooksFile(), null, 2) + '\n')
console.log('plugin synced: plugins/agent-receipts/hooks')
