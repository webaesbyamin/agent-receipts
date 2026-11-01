// A fake MCP server (stdio, newline-delimited JSON-RPC) for the proxy tests.
// FAKE_LOG=<dir>: writes the exact bytes it received (in.bin) and wrote (out.bin), and its argv (argv.json).
// FAKE_EXIT_CODE=<n>: exit code when stdin ends.
import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const log = process.env.FAKE_LOG
if (log) writeFileSync(join(log, 'argv.json'), JSON.stringify(process.argv.slice(2)))
const send = (msg) => {
  const bytes = Buffer.from(JSON.stringify(msg) + '\n')
  if (log) appendFileSync(join(log, 'out.bin'), bytes)
  process.stdout.write(bytes)
}

let buf = ''
process.stdin.on('data', (chunk) => {
  if (log) appendFileSync(join(log, 'in.bin'), chunk)
  buf += chunk.toString('utf8')
  let nl
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl)
    buf = buf.slice(nl + 1)
    if (line.trim()) handle(JSON.parse(line))
  }
})
process.stdin.on('end', () => process.exit(Number(process.env.FAKE_EXIT_CODE ?? 0)))

const waiting = new Map() // server-initiated request id -> resume

function handle(msg) {
  if (!('method' in msg)) {
    // The client's answer to our own request
    waiting.get(msg.id)?.(msg)
    waiting.delete(msg.id)
    return
  }
  if (msg.method === 'initialize') {
    return send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'fake-server', version: '1.0.0' } } })
  }
  if (msg.method === 'tools/list') return send({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'echo', inputSchema: { type: 'object' } }] } })
  if (msg.method === 'resources/list') return send({ jsonrpc: '2.0', id: msg.id, result: { resources: [{ uri: 'file:///x', name: 'x' }] } })
  if (msg.method === 'ping') return send({ jsonrpc: '2.0', id: msg.id, result: {} })
  if (msg.method !== 'tools/call') return // notifications (initialized, cancelled, …)

  const { name, arguments: args = {} } = msg.params
  const reply = (result) => send({ jsonrpc: '2.0', id: msg.id, result })
  switch (name) {
    case 'echo': return reply({ content: [{ type: 'text', text: `echo: ${args.text}` }] })
    case 'fail': return reply({ content: [{ type: 'text', text: 'SECRET-RESULT it failed' }], isError: true })
    case 'rpc-error': return send({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'SECRET-ERROR bad params' } })
    case 'slow': {
      const token = msg.params._meta?.progressToken
      if (token !== undefined) send({ jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: token, progress: 1, total: 2 } })
      return setTimeout(() => reply({ content: [{ type: 'text', text: `slow ${args.ms}` }] }), args.ms)
    }
    case 'big': return reply({ content: [{ type: 'text', text: 'é'.repeat(args.size) }] })
    case 'crash': return process.exit(3)
    case 'never': return // no response, ever
    case 'ask-client': {
      // A server → client request whose id collides with this tool call's id
      const id = msg.id
      waiting.set(id, (answer) => reply({ content: [{ type: 'text', text: `client said ${answer.result?.content?.text}` }] }))
      return send({ jsonrpc: '2.0', id, method: 'sampling/createMessage', params: { messages: [], maxTokens: 1 } })
    }
    default: return send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `no tool ${name}` } })
  }
}
