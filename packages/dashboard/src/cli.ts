#!/usr/bin/env node

import { spawn } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import path from 'path'
import os from 'os'

const PORT = process.env.PORT || '3274'
const DEFAULT_DATA_DIR = process.env.AGENT_RECEIPTS_DATA_DIR ||
  path.join(os.homedir(), '.agent-receipts')

// Parse flags
const args = process.argv.slice(2)
const noOpen = args.includes('--no-open')
const helpFlag = args.includes('--help') || args.includes('-h')
const portFlag = args.find(a => a.startsWith('--port='))
const actualPort = portFlag ? portFlag.split('=')[1] : PORT

if (helpFlag) {
  console.log(`
Agent Receipts — Mission Control Dashboard

Usage:
  npx @agent-receipts/dashboard [options]

Options:
  --port=<number>   Port to run on (default: 3274)
  --no-open         Don't open browser automatically
  --help, -h        Show this help message

Environment:
  AGENT_RECEIPTS_DATA_DIR   Data directory (default: ~/.agent-receipts)
  PORT                       Server port (default: 3274)
`)
  process.exit(0)
}

// Find the standalone server
const standaloneDir = path.join(__dirname, '..', 'standalone')
let serverPath = ''
const possiblePaths = [
  path.join(standaloneDir, 'apps', 'web', 'server.js'),
  path.join(standaloneDir, 'server.js'),
]

for (const p of possiblePaths) {
  if (existsSync(p)) {
    serverPath = p
    break
  }
}

if (!serverPath) {
  console.error('Error: Could not find standalone server.js')
  console.error('Searched in:')
  possiblePaths.forEach(p => console.error(`  ${p}`))
  console.error('\nTry reinstalling: npm install @agent-receipts/dashboard')
  process.exit(1)
}

// Count receipts for banner
let receiptCount = 0
const receiptsDir = path.join(DEFAULT_DATA_DIR, 'receipts')
if (existsSync(receiptsDir)) {
  try {
    receiptCount = readdirSync(receiptsDir).filter(f => f.endsWith('.json')).length
  } catch {
    // ignore
  }
}

// Print banner
console.log('')
console.log('  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557')
console.log('  \u2551   Agent Receipts \u2014 Mission Control       \u2551')
console.log('  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d')
console.log('')
console.log(`  Dashboard:  http://localhost:${actualPort}`)
console.log(`  Data:       ${DEFAULT_DATA_DIR}`)
if (receiptCount > 0) {
  console.log(`  Receipts:   ${receiptCount.toLocaleString()}`)
}
console.log('')
console.log('  Press Ctrl+C to stop')
console.log('')

// Start the server
const server = spawn('node', [serverPath], {
  env: {
    ...process.env,
    PORT: actualPort,
    HOSTNAME: '0.0.0.0',
    AGENT_RECEIPTS_DATA_DIR: DEFAULT_DATA_DIR,
  },
  stdio: 'inherit',
})

// Open browser after a short delay
if (!noOpen) {
  setTimeout(() => {
    const url = `http://localhost:${actualPort}`
    const platform = process.platform

    try {
      if (platform === 'darwin') {
        spawn('open', [url], { detached: true, stdio: 'ignore' })
      } else if (platform === 'win32') {
        spawn('cmd', ['/c', 'start', url], { detached: true, stdio: 'ignore' })
      } else {
        spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).on('error', () => {})
      }
    } catch {
      // Browser open failed — silently continue
    }
  }, 2000)
}

// Handle process signals
process.on('SIGINT', () => {
  server.kill('SIGINT')
  process.exit(0)
})

process.on('SIGTERM', () => {
  server.kill('SIGTERM')
  process.exit(0)
})

server.on('exit', (code) => {
  process.exit(code || 0)
})
