export interface StatsResponse {
  total_receipts: number
  receipts_today: number
  receipts_this_week: number
  active_agents: number
  constraint_pass_rate: number
  constraints_evaluated: number
  constraints_failed: number
  judgments_total: number
  judgments_pass_rate: number
  avg_latency_ms: number
  avg_cost_usd: number
  total_cost_usd: number
  receipt_volume: { date: string; count: number }[]
  constraint_trend: { date: string; pass_rate: number; total: number }[]
}

export interface ReceiptDetailResponse {
  receipt: Record<string, unknown>
  verified: boolean
  chain?: Record<string, unknown>[]
  judgments?: Record<string, unknown>[]
  children?: Record<string, unknown>[]
}

export interface ChainResponse {
  chain_id: string
  receipts: Record<string, unknown>[]
  agents: string[]
  total_duration_ms: number
  total_cost_usd: number
  constraint_pass_rate: number
  judgment_count: number
  tree: ChainNode[]
}

export interface ChainNode {
  receipt: Record<string, unknown>
  children: ChainNode[]
}

export interface AgentSummary {
  agent_id: string
  total_receipts: number
  last_active: string
  actions: string[]
  avg_latency_ms: number
  avg_cost_usd: number
  total_cost_usd: number
  constraint_pass_rate: number
  constraint_evaluated: number
  constraint_failed: number
  judgment_count: number
  judgment_pass_rate: number
  receipts_by_status: {
    completed: number
    failed: number
    pending: number
    timeout: number
  }
}

export interface VerifyResponse {
  verified: boolean
  public_key_used: string
  receipt_id: string
  error?: string
}

export interface SearchResult {
  receipts: { receipt_id: string; action: string; agent_id: string; timestamp: string }[]
  agents: string[]
  chains: string[]
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value))
    }
  }
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ''
}

export async function fetchStats(): Promise<StatsResponse> {
  return fetchApi<StatsResponse>('/api/stats')
}

export async function fetchReceipts(params: Record<string, string | number | boolean | undefined> = {}): Promise<PaginatedResponse<Record<string, unknown>>> {
  return fetchApi<PaginatedResponse<Record<string, unknown>>>(`/api/receipts${buildQueryString(params)}`)
}

export async function fetchReceipt(id: string): Promise<ReceiptDetailResponse> {
  return fetchApi<ReceiptDetailResponse>(`/api/receipts/${id}`)
}

export async function fetchChain(id: string): Promise<ChainResponse> {
  return fetchApi<ChainResponse>(`/api/chains/${id}`)
}

export async function fetchAgents(): Promise<{ agents: AgentSummary[] }> {
  return fetchApi<{ agents: AgentSummary[] }>('/api/agents')
}

export async function fetchJudgments(params: Record<string, string | number | boolean | undefined> = {}): Promise<PaginatedResponse<Record<string, unknown>>> {
  return fetchApi<PaginatedResponse<Record<string, unknown>>>(`/api/judgments${buildQueryString(params)}`)
}

export async function verifyReceipt(receipt: Record<string, unknown>, publicKey?: string): Promise<VerifyResponse> {
  return fetchApi<VerifyResponse>('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt, public_key: publicKey }),
  })
}

export async function runCleanup(dryRun = false): Promise<{ deleted: number; remaining: number; expired_receipts?: Record<string, unknown>[] }> {
  return fetchApi('/api/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dry_run: dryRun }),
  })
}

export async function fetchConfig(): Promise<Record<string, unknown>> {
  return fetchApi<Record<string, unknown>>('/api/config')
}

export async function updateConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
  return fetchApi<Record<string, unknown>>('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export async function fetchSearch(q: string): Promise<SearchResult> {
  return fetchApi<SearchResult>(`/api/search${buildQueryString({ q })}`)
}

export interface InvoiceGenerateOptions {
  from: string
  to: string
  client?: { name: string; email?: string; address?: string }
  provider?: { name: string; email?: string; address?: string }
  group_by?: 'action' | 'agent' | 'day' | 'none'
  agent_ids?: string[]
  actions?: string[]
  constraints_passed_only?: boolean
  notes?: string
  payment_terms?: string
  format?: 'html' | 'json' | 'csv' | 'md'
  include_receipts?: boolean
}

export interface InvoiceResponse {
  invoice: Record<string, unknown>
  formatted: string
  format: string
}

export async function generateInvoice(options: InvoiceGenerateOptions): Promise<InvoiceResponse> {
  return fetchApi<InvoiceResponse>('/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
}
