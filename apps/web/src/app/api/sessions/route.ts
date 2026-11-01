import { NextResponse } from 'next/server'
import { getStore } from '@/lib/storage'
import { listSessions } from '@/lib/sessions'

export const dynamic = 'force-dynamic'

/** Claude Code sessions (hooks) and MCP proxy sessions, newest first. */
export async function GET() {
  try {
    return NextResponse.json({ sessions: await listSessions(await getStore()) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
