'use client'

import { useState, useEffect, useCallback } from 'react'
import { AUTO_REFRESH_INTERVAL } from '@/lib/constants'

const STORAGE_KEY = 'agent-receipts-auto-refresh'
const INTERVAL_KEY = 'agent-receipts-refresh-interval'

function getStored(): { enabled: boolean; interval: number } {
  if (typeof window === 'undefined') return { enabled: true, interval: AUTO_REFRESH_INTERVAL }
  try {
    const enabled = localStorage.getItem(STORAGE_KEY) !== 'false'
    const interval = parseInt(localStorage.getItem(INTERVAL_KEY) ?? '', 10)
    return { enabled, interval: isNaN(interval) ? AUTO_REFRESH_INTERVAL : interval }
  } catch {
    return { enabled: true, interval: AUTO_REFRESH_INTERVAL }
  }
}

export function useAutoRefresh() {
  const [enabled, setEnabled] = useState(true)
  const [interval, setInterval_] = useState(AUTO_REFRESH_INTERVAL)

  useEffect(() => {
    const stored = getStored()
    setEnabled(stored.enabled)
    setInterval_(stored.interval)
  }, [])

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      return next
    })
  }, [])

  const setInterval = useCallback((ms: number) => {
    setInterval_(ms)
    try { localStorage.setItem(INTERVAL_KEY, String(ms)) } catch {}
  }, [])

  return {
    enabled,
    interval,
    toggle,
    setInterval,
    refreshInterval: enabled ? interval : 0,
  }
}
