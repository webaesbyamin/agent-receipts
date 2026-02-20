'use client'

import useSWR from 'swr'
import { fetchReceipts, buildQueryString, type PaginatedResponse } from '@/lib/api'
import { useAutoRefresh } from './use-auto-refresh'

export function useReceipts(params: Record<string, string | number | boolean | undefined> = {}) {
  const { refreshInterval } = useAutoRefresh()
  const key = `receipts${buildQueryString(params)}`

  return useSWR<PaginatedResponse<Record<string, unknown>>>(key, () => fetchReceipts(params), {
    refreshInterval,
    revalidateOnFocus: true,
  })
}
