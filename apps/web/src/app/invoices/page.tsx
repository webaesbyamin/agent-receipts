'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { generateInvoice as generateInvoiceApi, fetchAgents, type InvoiceResponse } from '@/lib/api'
import { FileText, Download, Printer } from 'lucide-react'
import { cn } from '@/lib/cn'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function thirtyDaysAgoISO() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default function InvoicesPage() {
  const [from, setFrom] = useState(thirtyDaysAgoISO)
  const [to, setTo] = useState(todayISO)
  const [clientName, setClientName] = useState('')
  const [providerName, setProviderName] = useState('')
  const [groupBy, setGroupBy] = useState<'action' | 'agent' | 'day' | 'none'>('none')
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [constraintsPassedOnly, setConstraintsPassedOnly] = useState(false)

  const [result, setResult] = useState<InvoiceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: agentsData } = useSWR('agents', fetchAgents)
  const agents = agentsData?.agents ?? []
  const allActions = [...new Set(agents.flatMap((a) => a.actions))].sort()

  const handleGenerate = useCallback(async () => {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await generateInvoiceApi({
        from,
        to,
        client: clientName ? { name: clientName } : undefined,
        provider: providerName ? { name: providerName } : undefined,
        group_by: groupBy,
        agent_ids: agentFilter ? [agentFilter] : undefined,
        actions: actionFilter ? [actionFilter] : undefined,
        constraints_passed_only: constraintsPassedOnly || undefined,
        notes: notes || undefined,
        payment_terms: paymentTerms || undefined,
        format: 'html',
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoice')
    } finally {
      setLoading(false)
    }
  }, [from, to, clientName, providerName, groupBy, agentFilter, actionFilter, constraintsPassedOnly, notes, paymentTerms])

  const handleDownload = useCallback(async (format: 'html' | 'json' | 'csv' | 'md') => {
    try {
      const res = await generateInvoiceApi({
        from,
        to,
        client: clientName ? { name: clientName } : undefined,
        provider: providerName ? { name: providerName } : undefined,
        group_by: groupBy,
        agent_ids: agentFilter ? [agentFilter] : undefined,
        actions: actionFilter ? [actionFilter] : undefined,
        constraints_passed_only: constraintsPassedOnly || undefined,
        notes: notes || undefined,
        payment_terms: paymentTerms || undefined,
        format,
        include_receipts: format === 'json',
      })

      const ext = format === 'md' ? 'md' : format
      const mime = format === 'html' ? 'text/html'
        : format === 'csv' ? 'text/csv'
        : format === 'md' ? 'text/markdown'
        : 'application/json'
      const invoice = res.invoice as Record<string, unknown>
      const blob = new Blob([res.formatted], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoice.invoice_number ?? 'export'}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Silently fail on download errors
    }
  }, [from, to, clientName, providerName, groupBy, agentFilter, actionFilter, constraintsPassedOnly, notes, paymentTerms])

  const handlePrint = useCallback(() => {
    if (!result) return
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(result.formatted)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }, [result])

  const invoiceData = result?.invoice as Record<string, unknown> | undefined
  const summary = invoiceData?.summary as Record<string, unknown> | undefined

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">Generate Invoice</h1>

      {/* Form */}
      <div className="card p-6 space-y-4">
        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary text-text-primary"
            />
          </div>
        </div>

        {/* Provider / Client */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Provider Name</label>
            <input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="Your company name"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary text-text-primary placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client / bill-to name"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary text-text-primary placeholder:text-text-muted"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary text-text-primary"
            >
              <option value="none">None</option>
              <option value="action">Action</option>
              <option value="agent">Agent</option>
              <option value="day">Day</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Agent</label>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary text-text-primary"
            >
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a.agent_id} value={a.agent_id}>{a.agent_id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary text-text-primary"
            >
              <option value="">All actions</option>
              {allActions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes / Payment terms */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Payment Terms</label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="e.g. Net 30"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary text-text-primary placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg-primary text-text-primary placeholder:text-text-muted"
            />
          </div>
        </div>

        {/* Constraints checkbox */}
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={constraintsPassedOnly}
            onChange={(e) => setConstraintsPassedOnly(e.target.checked)}
            className="rounded border-border"
          />
          Only include receipts with passed constraints
        </label>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !from || !to}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FileText className="w-4 h-4" />
          {loading ? 'Generating...' : 'Generate Invoice'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-danger-subtle border border-danger/20">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <span className="text-text-secondary">
                Invoice <span className="font-mono font-medium text-text-primary">{String(invoiceData?.invoice_number ?? '')}</span>
              </span>
              <span className="text-text-secondary">
                Receipts: <span className="font-medium text-text-primary">{String(summary?.total_receipts ?? 0)}</span>
              </span>
              <span className="text-text-secondary">
                Total: <span className="font-medium text-text-primary">${Number(summary?.total_cost_usd ?? 0).toFixed(4)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md text-text-secondary hover:bg-bg-secondary transition-colors"
              >
                <Printer className="w-3 h-3" /> Print / PDF
              </button>
              {(['html', 'json', 'csv', 'md'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleDownload(fmt)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md text-text-secondary hover:bg-bg-secondary transition-colors"
                >
                  <Download className="w-3 h-3" /> {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className={cn('card overflow-hidden', 'border border-border')}>
            <iframe
              srcDoc={result.formatted}
              title="Invoice Preview"
              className="w-full bg-white"
              style={{ minHeight: '600px', border: 'none' }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Demo sample invoice */}
      {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && !result && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">Sample Invoice Output</h3>
          <div className="bg-bg-secondary rounded-lg p-6 border border-border font-mono text-sm">
            <pre className="whitespace-pre-wrap text-text-secondary">{`# Agent Services Invoice

Invoice #: AR-20260401-X7K2
Period: Mar 1, 2026 - Mar 31, 2026
Generated: Apr 2, 2026

Provider: Acme AI Agency
Client: TechCorp Inc.

## Summary

| Metric          | Value   |
|-----------------|---------|
| Total Receipts  | 120     |
| Total Cost      | $3.93   |
| Avg Latency     | 5.5s    |
| Constraint Pass | 58.3%   |

## By Action

| Action          | Count | Cost    |
|-----------------|-------|---------|
| code_review     | 18    | $0.72   |
| generate_code   | 15    | $0.61   |
| analyze_data    | 14    | $0.55   |
| run_tests       | 12    | $0.44   |
| ...             | ...   | ...     |

Verification: agentreceipts.dev/verify`}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
