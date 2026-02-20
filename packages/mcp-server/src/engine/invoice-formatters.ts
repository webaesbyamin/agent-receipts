import type { Invoice, InvoiceLineItem } from './invoice.js'

export function formatInvoiceJSON(invoice: Invoice, includeReceipts = false): string {
  if (!includeReceipts) {
    const stripped = {
      ...invoice,
      groups: invoice.groups.map((g) => ({
        ...g,
        items: g.items.map(({ receipt, ...rest }) => rest),
      })),
    }
    return JSON.stringify(stripped, null, 2)
  }
  return JSON.stringify(invoice, null, 2)
}

export function formatInvoiceCSV(invoice: Invoice): string {
  const lines: string[] = []

  // Header
  lines.push('receipt_id,action,agent_id,timestamp,description,cost_usd,latency_ms,model,tokens_in,tokens_out,constraints_passed,group')

  for (const group of invoice.groups) {
    for (const item of group.items) {
      lines.push([
        csvEscape(item.receipt_id),
        csvEscape(item.action),
        csvEscape(item.agent_id),
        csvEscape(item.timestamp),
        csvEscape(item.description),
        item.cost_usd ?? '',
        item.latency_ms ?? '',
        csvEscape(item.model ?? ''),
        item.tokens_in ?? '',
        item.tokens_out ?? '',
        item.constraints_passed ?? '',
        csvEscape(group.label),
      ].join(','))
    }
  }

  // Summary row
  lines.push('')
  lines.push(`# Invoice: ${invoice.invoice_number}`)
  lines.push(`# Period: ${invoice.period.from} to ${invoice.period.to}`)
  lines.push(`# Total Receipts: ${invoice.summary.total_receipts}`)
  lines.push(`# Total Cost: $${invoice.summary.total_cost_usd.toFixed(4)}`)

  return lines.join('\n')
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function formatInvoiceMarkdown(invoice: Invoice): string {
  const lines: string[] = []

  lines.push(`# Invoice ${invoice.invoice_number}`)
  lines.push('')
  lines.push(`**Generated:** ${invoice.generated_at}`)
  lines.push(`**Period:** ${invoice.period.from} to ${invoice.period.to}`)
  lines.push('')

  if (invoice.provider) {
    lines.push('## Provider')
    lines.push(`**${invoice.provider.name}**`)
    if (invoice.provider.email) lines.push(`Email: ${invoice.provider.email}`)
    if (invoice.provider.address) lines.push(`Address: ${invoice.provider.address}`)
    lines.push('')
  }

  if (invoice.client) {
    lines.push('## Bill To')
    lines.push(`**${invoice.client.name}**`)
    if (invoice.client.email) lines.push(`Email: ${invoice.client.email}`)
    if (invoice.client.address) lines.push(`Address: ${invoice.client.address}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('')

  for (const group of invoice.groups) {
    lines.push(`### ${group.label}`)
    lines.push('')
    lines.push('| Receipt ID | Action | Agent | Description | Cost |')
    lines.push('|------------|--------|-------|-------------|------|')
    for (const item of group.items) {
      const cost = item.cost_usd !== null ? `$${item.cost_usd.toFixed(4)}` : '-'
      const desc = item.description.length > 50 ? item.description.slice(0, 47) + '...' : item.description
      lines.push(`| \`${item.receipt_id}\` | ${item.action} | ${item.agent_id} | ${desc} | ${cost} |`)
    }
    lines.push('')
    lines.push(`**Subtotal:** $${group.subtotal_usd.toFixed(4)} (${group.count} items)`)
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Total Receipts | ${invoice.summary.total_receipts} |`)
  lines.push(`| Total Cost | $${invoice.summary.total_cost_usd.toFixed(4)} |`)
  lines.push(`| Avg Cost | $${invoice.summary.avg_cost_usd.toFixed(4)} |`)
  lines.push(`| Total Tokens (in) | ${invoice.summary.total_tokens_in} |`)
  lines.push(`| Total Tokens (out) | ${invoice.summary.total_tokens_out} |`)
  lines.push(`| Avg Latency | ${Math.round(invoice.summary.avg_latency_ms)}ms |`)

  if (invoice.summary.constraints_evaluated > 0) {
    lines.push(`| Constraints Passed | ${invoice.summary.constraints_passed}/${invoice.summary.constraints_evaluated} |`)
  }

  lines.push('')

  if (invoice.notes) {
    lines.push('## Notes')
    lines.push('')
    lines.push(invoice.notes)
    lines.push('')
  }

  if (invoice.payment_terms) {
    lines.push('## Payment Terms')
    lines.push('')
    lines.push(invoice.payment_terms)
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## Verification')
  lines.push('')
  lines.push('Every line item is a cryptographically signed receipt that can be independently verified.')
  lines.push('')
  lines.push(`**Public Key:** \`${invoice.public_key}\``)
  lines.push('')

  return lines.join('\n')
}

export function formatInvoiceHTML(invoice: Invoice): string {
  const providerSection = invoice.provider ? `
    <div class="party">
      <h3>From</h3>
      <p class="party-name">${esc(invoice.provider.name)}</p>
      ${invoice.provider.email ? `<p>${esc(invoice.provider.email)}</p>` : ''}
      ${invoice.provider.address ? `<p>${esc(invoice.provider.address)}</p>` : ''}
    </div>` : ''

  const clientSection = invoice.client ? `
    <div class="party">
      <h3>Bill To</h3>
      <p class="party-name">${esc(invoice.client.name)}</p>
      ${invoice.client.email ? `<p>${esc(invoice.client.email)}</p>` : ''}
      ${invoice.client.address ? `<p>${esc(invoice.client.address)}</p>` : ''}
    </div>` : ''

  const groupSections = invoice.groups.map((group) => `
    <div class="group">
      <h3>${esc(group.label)}</h3>
      <table>
        <thead>
          <tr>
            <th>Receipt ID</th>
            <th>Action</th>
            <th>Agent</th>
            <th>Description</th>
            <th>Timestamp</th>
            <th class="num">Cost</th>
          </tr>
        </thead>
        <tbody>
          ${group.items.map((item) => itemRow(item)).join('\n')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" class="subtotal-label">Subtotal (${group.count} items)</td>
            <td class="num subtotal-value">$${group.subtotal_usd.toFixed(4)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`).join('\n')

  const constraintRow = invoice.summary.constraints_evaluated > 0
    ? `<tr><td>Constraints Passed</td><td>${invoice.summary.constraints_passed}/${invoice.summary.constraints_evaluated}</td></tr>`
    : ''

  const notesSection = invoice.notes
    ? `<div class="section"><h3>Notes</h3><p>${esc(invoice.notes)}</p></div>`
    : ''

  const paymentSection = invoice.payment_terms
    ? `<div class="section"><h3>Payment Terms</h3><p>${esc(invoice.payment_terms)}</p></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${esc(invoice.invoice_number)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.5; padding: 40px; max-width: 1000px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }
    .header h1 { font-size: 28px; font-weight: 700; color: #111; }
    .header .invoice-number { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .header .meta { text-align: right; font-size: 13px; color: #6b7280; }
    .parties { display: flex; gap: 48px; margin-bottom: 32px; }
    .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 4px; }
    .party-name { font-weight: 600; font-size: 15px; }
    .party p { font-size: 13px; color: #4b5563; }
    .group { margin-bottom: 24px; }
    .group h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #374151; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 8px 10px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
    td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; color: #4b5563; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .receipt-id { font-family: ui-monospace, monospace; font-size: 11px; color: #6b7280; }
    .subtotal-label { text-align: right; font-weight: 600; color: #374151; }
    .subtotal-value { font-weight: 600; color: #111; }
    .summary { margin-top: 32px; padding-top: 24px; border-top: 2px solid #e5e7eb; }
    .summary h3 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .summary table { max-width: 360px; }
    .summary td { padding: 5px 10px; }
    .summary td:first-child { font-weight: 500; color: #374151; }
    .summary td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .total-row td { font-size: 16px; font-weight: 700; color: #111; border-top: 2px solid #e5e7eb; padding-top: 10px; }
    .section { margin-top: 24px; }
    .section h3 { font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #374151; }
    .section p { font-size: 13px; color: #4b5563; }
    .verification { margin-top: 32px; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; }
    .verification h3 { font-size: 13px; font-weight: 600; color: #166534; margin-bottom: 6px; }
    .verification p { font-size: 12px; color: #15803d; }
    .verification code { font-family: ui-monospace, monospace; font-size: 11px; background: #dcfce7; padding: 2px 6px; border-radius: 3px; word-break: break-all; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
    @media print {
      body { padding: 20px; }
      .verification { break-inside: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Invoice</h1>
      <div class="invoice-number">${esc(invoice.invoice_number)}</div>
    </div>
    <div class="meta">
      <div>Generated: ${esc(formatDate(invoice.generated_at))}</div>
      <div>Period: ${esc(formatDate(invoice.period.from))} &mdash; ${esc(formatDate(invoice.period.to))}</div>
    </div>
  </div>

  ${(providerSection || clientSection) ? `<div class="parties">${providerSection}${clientSection}</div>` : ''}

  ${groupSections}

  <div class="summary">
    <h3>Summary</h3>
    <table>
      <tr class="total-row"><td>Total Cost</td><td>$${invoice.summary.total_cost_usd.toFixed(4)}</td></tr>
      <tr><td>Total Receipts</td><td>${invoice.summary.total_receipts}</td></tr>
      <tr><td>Avg Cost per Receipt</td><td>$${invoice.summary.avg_cost_usd.toFixed(4)}</td></tr>
      <tr><td>Total Tokens (in/out)</td><td>${invoice.summary.total_tokens_in} / ${invoice.summary.total_tokens_out}</td></tr>
      <tr><td>Avg Latency</td><td>${Math.round(invoice.summary.avg_latency_ms)}ms</td></tr>
      ${constraintRow}
    </table>
  </div>

  ${notesSection}
  ${paymentSection}

  <div class="verification">
    <h3>Verification</h3>
    <p>Every line item is a cryptographically signed receipt that can be independently verified.</p>
    <p style="margin-top: 6px;">Public Key: <code>${esc(invoice.public_key)}</code></p>
  </div>

  <div class="footer">
    Generated by Agent Receipts &mdash; ${esc(invoice.invoice_number)}
  </div>
</body>
</html>`
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function itemRow(item: InvoiceLineItem): string {
  const cost = item.cost_usd !== null ? `$${item.cost_usd.toFixed(4)}` : '-'
  const desc = item.description.length > 60 ? item.description.slice(0, 57) + '...' : item.description
  const ts = formatDate(item.timestamp)
  return `          <tr>
            <td class="receipt-id">${esc(item.receipt_id)}</td>
            <td>${esc(item.action)}</td>
            <td>${esc(item.agent_id)}</td>
            <td>${esc(desc)}</td>
            <td>${esc(ts)}</td>
            <td class="num">${cost}</td>
          </tr>`
}
