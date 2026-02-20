'use client'

import useSWR from 'swr'
import { fetchStats, type StatsResponse } from '@/lib/api'
import { useAutoRefresh } from './use-auto-refresh'

export function useStats() {
  const { refreshInterval } = useAutoRefresh()

  return useSWR<StatsResponse>('stats', fetchStats, {
    refreshInterval,
    revalidateOnFocus: true,
  })
}
