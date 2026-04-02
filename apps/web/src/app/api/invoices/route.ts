import { NextResponse } from 'next/server'
import { getStore, getKeyManager, isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return Response.json(
        { message: 'This is a demo. Connect your own Agent Receipts instance to enable writes.' },
        { status: 200 }
      )
    }

    const {
      generateInvoice,
      formatInvoiceJSON,
      formatInvoiceCSV,
      formatInvoiceMarkdown,
      formatInvoiceHTML,
    } = await import('@agent-receipts/mcp-server')

    const body = await request.json()
    const { from, to, client, provider, group_by, agent_ids, actions, constraints_passed_only, notes, payment_terms, format, include_receipts } = body

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to dates are required' }, { status: 400 })
    }

    const store = await getStore()
    const keyManager = await getKeyManager()

    const options = {
      from,
      to,
      client,
      provider,
      group_by,
      agent_ids,
      actions,
      constraints_passed_only,
      notes,
      payment_terms,
    }

    const invoice = await generateInvoice(store as any, keyManager as any, options)

    const fmt = format ?? 'json'
    let formatted: string
    if (fmt === 'html') {
      formatted = formatInvoiceHTML(invoice)
    } else if (fmt === 'csv') {
      formatted = formatInvoiceCSV(invoice)
    } else if (fmt === 'md') {
      formatted = formatInvoiceMarkdown(invoice)
    } else {
      formatted = formatInvoiceJSON(invoice, include_receipts ?? false)
    }

    return NextResponse.json({ invoice, formatted, format: fmt })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
