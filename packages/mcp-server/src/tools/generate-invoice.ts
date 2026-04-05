import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'
import { formatInvoiceJSON, formatInvoiceCSV, formatInvoiceMarkdown } from '../engine/invoice-formatters.js'
import type { InvoiceOptions } from '../engine/invoice.js'

export function registerGenerateInvoice(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'generate_invoice',
    'Generate a client invoice from cryptographically signed receipts within a date range. Aggregates receipt data by agent, action, or day and calculates total costs, token usage, and receipt counts. Supports JSON, CSV, and Markdown output formats. Each line item references a signed receipt for verifiable billing. Use to bill clients for AI agent work with cryptographic proof of every billed action.',
    {
      from: z.string().describe('Invoice period start date in ISO 8601 format (e.g., "2026-01-01" or "2026-01-01T00:00:00Z")'),
      to: z.string().describe('Invoice period end date in ISO 8601 format (e.g., "2026-01-31" or "2026-01-31T23:59:59Z")'),
      client_name: z.string().optional().describe('Client or bill-to name for the invoice header'),
      client_email: z.string().optional().describe('Client email address'),
      provider_name: z.string().optional().describe('Your company or provider name'),
      provider_email: z.string().optional().describe('Your email address'),
      group_by: z.enum(['action', 'agent', 'day', 'none']).optional().describe('How to group line items: "action" (by action name), "agent" (by agent ID), "day" (by date), or "none" (single total)'),
      format: z.enum(['json', 'csv', 'md']).optional().describe('Output format: "json" (structured data), "csv" (spreadsheet), or "md" (markdown table)'),
      include_receipts: z.boolean().optional().describe('If true, includes full receipt objects in JSON output for full auditability'),
      agent_ids: z.array(z.string()).optional().describe('Filter to specific agent IDs only'),
      actions: z.array(z.string()).optional().describe('Filter to specific action names only'),
      constraints_passed_only: z.boolean().optional().describe('If true, only include receipts where all constraints passed'),
      notes: z.string().optional().describe('Additional notes to include in the invoice'),
      payment_terms: z.string().optional().describe('Payment terms text (e.g., "Net 30", "Due on receipt")'),
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
