import { NextResponse } from 'next/server'
import { getStore, getKeyManager } from '@/lib/sdk-server'
import {
  generateInvoice,
  formatInvoiceJSON,
  formatInvoiceCSV,
  formatInvoiceMarkdown,
  formatInvoiceHTML,
} from '@agent-receipts/mcp-server'
import type { InvoiceOptions } from '@agent-receipts/mcp-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { from, to, client, provider, group_by, agent_ids, actions, constraints_passed_only, notes, payment_terms, format, include_receipts } = body

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to dates are required' }, { status: 400 })
    }

    const store = await getStore()
    const keyManager = await getKeyManager()

    const options: InvoiceOptions = {
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

    const invoice = await generateInvoice(store, keyManager, options)

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
