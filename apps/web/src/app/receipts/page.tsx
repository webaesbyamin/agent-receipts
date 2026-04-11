'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback, Suspense } from 'react'
import { useReceipts } from '@/hooks/use-receipts'
import { DataTable, type Column } from '@/components/shared/data-table'
import { Pagination } from '@/components/shared/pagination'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConstraintBadge } from '@/components/shared/constraint-badge'
import { TimeAgo } from '@/components/shared/time-ago'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingTable } from '@/components/shared/loading'
import { truncateId, formatDuration, formatCurrency } from '@/lib/formatters'
import { Receipt, Download, RefreshCw, X } from 'lucide-react'
import Link from 'next/link'

function ReceiptExplorerContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')

  const params: Record<string, string | number | boolean | undefined> = {
    page: parseInt(searchParams.get('page') ?? '1', 10),
    limit: parseInt(searchParams.get('limit') ?? '50', 10),
    sort: searchParams.get('sort') ?? 'timestamp:desc',
    agent_id: searchParams.get('agent_id') ?? undefined,
    action: searchParams.get('action') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    constraint_passed: searchParams.get('constraint_passed') ?? undefined,
    receipt_type: searchParams.get('receipt_type') ?? undefined,
    environment: searchParams.get('environment') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  }

  const { data, error, isLoading, mutate } = useReceipts(params)

  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) sp.set(key, value)
      else sp.delete(key)
    }
    if (!updates.page) sp.set('page', '1')
    router.push(`/receipts?${sp.toString()}`)
  }, [searchParams, router])

  const handleSearch = useCallback(() => {
    updateParams({ search: searchInput || undefined })
  }, [searchInput, updateParams])

  const handleSort = useCallback((field: string) => {
    const currentSort = searchParams.get('sort') ?? 'timestamp:desc'
    const [currentField, currentDir] = currentSort.split(':')
    const newDir = currentField === field && currentDir === 'desc' ? 'asc' : 'desc'
    updateParams({ sort: `${field}:${newDir}` })
  }, [searchParams, updateParams])

  const clearFilters = useCallback(() => {
    router.push('/receipts')
    setSearchInput('')
  }, [router])

  const hasFilters = searchParams.get('agent_id') || searchParams.get('action') || searchParams.get('status') ||
    searchParams.get('constraint_passed') || searchParams.get('receipt_type') || searchParams.get('environment') ||
    searchParams.get('search')

  const currentSort = searchParams.get('sort') ?? 'timestamp:desc'
  const [sortField, sortDir] = currentSort.split(':')

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'timestamp',
      label: 'Time',
      sortable: true,
      render: (r) => <TimeAgo date={r.timestamp as string} className="text-xs" />,
    },
    {
      key: 'receipt_id',
      label: 'Receipt ID',
      render: (r) => (
        <code className="font-mono text-xs text-primary">{truncateId(r.receipt_id as string)}</code>
      ),
    },
    {
      key: 'agent_id',
      label: 'Agent',
      sortable: true,
      render: (r) => (
        <Link
          href={`/agents/${r.agent_id}`}
          className="text-xs text-text-secondary hover:text-primary"
          onClick={e => e.stopPropagation()}
        >
          {r.agent_id as string}
        </Link>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      sortable: true,
      render: (r) => (
        <span className="text-sm flex items-center gap-1.5">
          {r.receipt_type === 'memory' && (
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500 shrink-0" title="Memory receipt" />
          )}
          {r.action as string}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => <StatusBadge status={r.status as string} />,
    },
    {
      key: 'constraints',
      label: 'Constraints',
      render: (r) => {
        const cr = r.constraint_result as { passed?: boolean; results?: { passed: boolean }[] } | null
        if (!cr || !Array.isArray(cr.results)) return <span className="text-text-muted text-xs">—</span>
        const passed = cr.results.filter(x => x.passed).length
        return <ConstraintBadge passed={passed} total={cr.results.length} />
      },
    },
    {
      key: 'latency_ms',
      label: 'Latency',
      sortable: true,
      render: (r) => <span className="text-xs text-text-secondary">{formatDuration(r.latency_ms as number | null)}</span>,
    },
    {
      key: 'cost_usd',
      label: 'Cost',
      sortable: true,
      render: (r) => <span className="text-xs text-text-secondary">{formatCurrency(r.cost_usd as number | null)}</span>,
    },
    {
      key: 'chain_id',
      label: 'Chain',
      render: (r) => r.chain_id ? (
        <Link
          href={`/chains/${r.chain_id}`}
          className="font-mono text-xs text-primary hover:underline"
          onClick={e => e.stopPropagation()}
        >
          {truncateId(r.chain_id as string, 10)}
        </Link>
      ) : <span className="text-text-muted text-xs">—</span>,
    },
  ]

  const handleExport = useCallback(() => {
    if (!data) return
    const json = JSON.stringify(data.data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipts-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [data])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Receipts</h1>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={searchParams.get('status') ?? ''}
            onChange={e => updateParams({ status: e.target.value || undefined })}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-bg-primary text-text-primary"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="timeout">Timeout</option>
          </select>

          <select
            value={searchParams.get('constraint_passed') ?? ''}
            onChange={e => updateParams({ constraint_passed: e.target.value || undefined })}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-bg-primary text-text-primary"
          >
            <option value="">All Constraints</option>
            <option value="true">Passed</option>
            <option value="false">Failed</option>
          </select>

          <select
            value={searchParams.get('receipt_type') ?? ''}
            onChange={e => updateParams({ receipt_type: e.target.value || undefined })}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-bg-primary text-text-primary"
          >
            <option value="">All Types</option>
            <option value="action">Action</option>
            <option value="judgment">Judgment</option>
            <option value="arbitration">Arbitration</option>
            <option value="memory">Memory</option>
          </select>

          <select
            value={searchParams.get('environment') ?? ''}
            onChange={e => updateParams({ environment: e.target.value || undefined })}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-bg-primary text-text-primary"
          >
            <option value="">All Environments</option>
            <option value="development">Development</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="test">Test</option>
          </select>

          <div className="flex-1 flex items-center gap-2 min-w-[200px]">
            <input
              type="text"
              placeholder="Search..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-3 py-1.5 text-sm border border-border rounded-md bg-bg-primary text-text-primary placeholder:text-text-muted"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results bar */}
      {data && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">
            Showing {((data.pagination.page - 1) * data.pagination.limit) + 1}–{Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total} receipts
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              <Download className="w-3 h-3" /> Export
            </button>
            <button
              onClick={() => mutate()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading ? (
        <LoadingTable rows={10} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No receipts found"
          description={hasFilters ? 'Try adjusting your filters' : 'Create receipts using the MCP server, SDK, or CLI'}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data.data}
            sortField={sortField}
            sortDir={sortDir as 'asc' | 'desc'}
            onSort={handleSort}
            onRowClick={r => router.push(`/receipts/${r.receipt_id}`)}
            rowKey={r => r.receipt_id as string}
          />

          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.total_pages}
            onPageChange={p => updateParams({ page: String(p) })}
          />
        </>
      )}
    </div>
  )
}

export default function ReceiptExplorerPage() {
  return (
    <Suspense fallback={<LoadingTable rows={10} />}>
      <ReceiptExplorerContent />
    </Suspense>
  )
}
