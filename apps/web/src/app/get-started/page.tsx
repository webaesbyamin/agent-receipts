'use client'

import { useState, useCallback } from 'react'
import { Database, Check, Copy } from 'lucide-react'

const MCP_CONFIG = `{
  "mcpServers": {
    "agent-receipts": {
      "command": "npx",
      "args": ["@agent-receipts/mcp-server"]
    }
  }
}`

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <div className="relative bg-gray-950 dark:bg-gray-900 rounded-xl p-5 border border-gray-800">
      <pre className="text-sm text-green-400 font-mono leading-relaxed overflow-x-auto">{text}</pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}

export default function GetStartedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">

        <div className="flex items-center gap-3 mb-8">
          <Database className="w-6 h-6 text-blue-500" />
          <span className="text-xl font-semibold text-gray-900 dark:text-white">
            Agent Receipts
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Cryptographic receipts for every AI agent action.
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-10 text-base leading-relaxed">
          Every receipt is Ed25519 signed, stored locally, and verifiable
          without a server. Works with Claude Desktop, Claude Code, Cursor, and VS Code.
        </p>

        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Step 1 — Add to your MCP config
          </p>
          <CopyBlock text={MCP_CONFIG} />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Config locations:{' '}
            <span className="font-mono">Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json</span>
            {' · '}
            <span className="font-mono">Claude Code: .mcp.json</span>
            {' · '}
            <span className="font-mono">Cursor: .cursor/mcp.json</span>
          </p>
        </div>

        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Step 2 — Restart your AI client
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Restart Claude Desktop, Cursor, or VS Code.
            Agent Receipts will appear in your available tools.
          </p>
        </div>

        <div className="mb-10">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Step 3 — Start an agent task
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Every action your agent takes now generates a signed receipt.
            View them in the local dashboard:
          </p>
          <CopyBlock text="npx @agent-receipts/dashboard" />
        </div>

        <div className="flex items-center gap-6 text-sm">
          <a
            href="https://github.com/webaesbyamin/agent-receipts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            GitHub &rarr;
          </a>
          <a href="/how-it-works" className="text-gray-500 dark:text-gray-400 hover:underline">
            How it works
          </a>
          <a href="/" className="text-gray-500 dark:text-gray-400 hover:underline">
            View demo dashboard
          </a>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-600 mt-8">
          @agent-receipts/mcp-server · MIT License
        </p>

      </div>
    </div>
  )
}
