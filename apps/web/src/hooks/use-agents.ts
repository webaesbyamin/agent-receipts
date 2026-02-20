'use client'

import useSWR from 'swr'
import { fetchAgents, type AgentSummary } from '@/lib/api'
import { useAutoRefresh } from './use-auto-refresh'

export function useAgents() {
  const { refreshInterval } = useAutoRefresh()

  return useSWR<{ agents: AgentSummary[] }>('agents', fetchAgents, {
    refreshInterval,
    revalidateOnFocus: true,
  })
}
