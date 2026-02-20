import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'
import { formatInvoiceJSON, formatInvoiceCSV, formatInvoiceMarkdown } from '../engine/invoice-formatters.js'
import type { InvoiceOptions } from '../engine/invoice.js'

export function registerGenerateInvoice(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'generate_invoice',
    'Generate an invoice from completed receipts within a date range. Each line item is a cryptographically signed receipt.',
    {
      from: z.string().describe('Start date (ISO 8601, e.g. "2025-01-01")'),
      to: z.string().describe('End date (ISO 8601, e.g. "2025-01-31")'),
      client_name: z.string().optional().describe('Client/bill-to name'),
      client_email: z.string().optional().describe('Client email'),
      provider_name: z.string().optional().describe('Provider/from name'),
      provider_email: z.string().optional().describe('Provider email'),
      group_by: z.enum(['action', 'agent', 'day', 'none']).optional().describe('How to group line items (default: none)'),
      format: z.enum(['json', 'csv', 'md']).optional().describe('Output format (default: json)'),
      include_receipts: z.boolean().optional().describe('Include full receipt objects in JSON output (default: false)'),
      agent_ids: z.array(z.string()).optional().describe('Filter by specific agent IDs'),
      actions: z.array(z.string()).optional().describe('Filter by specific actions'),
      constraints_passed_only: z.boolean().optional().describe('Only include receipts with passed constraints'),
      notes: z.string().optional().describe('Notes to include on the invoice'),
      payment_terms: z.string().optional().describe('Payment terms (e.g. "Net 30")'),
    },
    async (params) => {
      const options: InvoiceOptions = {
        from: params.from,
        to: params.to,
        group_by: params.group_by,
        agent_ids: params.agent_ids,
        actions: params.actions,
        constraints_passed_only: params.constraints_passed_only,
        notes: params.notes,
        payment_terms: params.payment_terms,
      }

      if (params.client_name) {
        options.client = { name: params.client_name, email: params.client_email }
      }
      if (params.provider_name) {
        options.provider = { name: params.provider_name, email: params.provider_email }
      }

      const invoice = await engine.generateInvoice(options)

      const format = params.format ?? 'json'
      let text: string
      if (format === 'csv') {
        text = formatInvoiceCSV(invoice)
      } else if (format === 'md') {
        text = formatInvoiceMarkdown(invoice)
      } else {
        text = formatInvoiceJSON(invoice, params.include_receipts ?? false)
      }

      return {
        content: [{ type: 'text' as const, text }],
      }
    },
  )
}
