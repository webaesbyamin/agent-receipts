import {
  AgentReceipts,
  formatInvoiceJSON,
  formatInvoiceCSV,
  formatInvoiceMarkdown,
  formatInvoiceHTML,
} from '@agent-receipts/sdk'
import { writeFileSync } from 'node:fs'

async function main() {
  const ar = new AgentReceipts()

  // Create some sample receipts
  await ar.track({
    action: 'summarize_text',
    input: { text: 'Long document about AI safety...' },
    output: { summary: 'AI safety is important for alignment.' },
    output_summary: 'Summarized AI safety document',
    model: 'gpt-4',
    tokens_in: 500,
    tokens_out: 50,
    cost_usd: 0.015,
    latency_ms: 1200,
    tags: ['summarization'],
  })

  await ar.track({
    action: 'translate_text',
    input: { text: 'Hello, how are you?', target_lang: 'fr' },
    output: { translation: 'Bonjour, comment allez-vous?' },
    output_summary: 'Translated greeting to French',
    model: 'gpt-4',
    tokens_in: 20,
    tokens_out: 15,
    cost_usd: 0.002,
    latency_ms: 300,
    tags: ['translation'],
  })

  await ar.track({
    action: 'classify_sentiment',
    input: { text: 'This product is amazing!' },
    output: { sentiment: 'positive', confidence: 0.98 },
    output_summary: 'Classified as positive sentiment',
    model: 'gpt-3.5-turbo',
    tokens_in: 10,
    tokens_out: 5,
    cost_usd: 0.0003,
    latency_ms: 150,
    tags: ['classification'],
  })

  // Generate an invoice
  const invoice = await ar.generateInvoice({
    from: '2000-01-01',
    to: '2099-12-31',
    client: { name: 'Acme Corporation', email: 'billing@acme.com' },
    provider: { name: 'AI Solutions Inc.', email: 'invoices@aisolutions.com' },
    group_by: 'action',
    notes: 'Thank you for your business!',
    payment_terms: 'Net 30',
  })

  console.log(`Invoice generated: ${invoice.invoice_number}`)
  console.log(`Period: ${invoice.period.from} to ${invoice.period.to}`)
  console.log(`Total receipts: ${invoice.summary.total_receipts}`)
  console.log(`Total cost: $${invoice.summary.total_cost_usd.toFixed(4)}`)
  console.log(`Groups: ${invoice.groups.length}`)
  console.log()

  // Demonstrate all formatters
  console.log('=== JSON Format ===')
  const json = formatInvoiceJSON(invoice)
  console.log(json.slice(0, 200) + '...')
  console.log()

  console.log('=== CSV Format ===')
  const csv = formatInvoiceCSV(invoice)
  console.log(csv.split('\n').slice(0, 5).join('\n'))
  console.log('...')
  console.log()

  console.log('=== Markdown Format ===')
  const md = formatInvoiceMarkdown(invoice)
  console.log(md.split('\n').slice(0, 10).join('\n'))
  console.log('...')
  console.log()

  // Write HTML to file
  const html = formatInvoiceHTML(invoice)
  const filename = `invoice-${invoice.invoice_number}.html`
  writeFileSync(filename, html)
  console.log(`=== HTML invoice written to ${filename} ===`)
}

main().catch(console.error)
