'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchConfig, updateConfig, runCleanup } from '@/lib/api'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { StatCard } from '@/components/shared/stat-card'
import { CopyButton } from '@/components/shared/copy-button'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingPage } from '@/components/shared/loading'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/cn'
import { Database, Key, Trash2, Download } from 'lucide-react'

export default function SettingsPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number; remaining: number } | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)

  const { enabled: autoRefresh, interval, toggle: toggleAutoRefresh, setInterval: setRefreshInterval } = useAutoRefresh()

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    if (stored === 'dark') setTheme('dark')
    else if (stored === 'light') setTheme('light')
    else setTheme('system')
  }, [])

  const handleThemeChange = useCallback((t: 'light' | 'dark' | 'system') => {
    setTheme(t)
    if (t === 'system') {
      localStorage.removeItem('theme')
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', isDark)
    } else {
      localStorage.setItem('theme', t)
      document.documentElement.classList.toggle('dark', t === 'dark')
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const cfg = await fetchConfig()
        setConfig(cfg)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load config')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSaveConfig = useCallback(async (field: string, value: string) => {
    if (!config) return
    setSaving(true)
    try {
      const updated = await updateConfig({ [field]: value })
      setConfig(prev => ({ ...prev, ...updated }))
    } catch {} finally {
      setSaving(false)
    }
  }, [config])

  const handleCleanup = useCallback(async (dryRun: boolean) => {
    setCleanupLoading(true)
    try {
      const result = await runCleanup(dryRun)
      setCleanupResult(result)
      if (!dryRun) {
        // Refresh config to update receipt count
        const cfg = await fetchConfig()
        setConfig(cfg)
      }
    } catch {} finally {
      setCleanupLoading(false)
    }
  }, [])

  const handleExportAll = useCallback(async () => {
    try {
      const res = await fetch('/api/receipts?limit=10000') // TODO: replace with server-side aggregation in v0.3.0
      const data = await res.json()
      const json = JSON.stringify(data.data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `all-receipts-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }, [])

  if (error) return <ErrorState message={error} />
  if (loading || !config) return <LoadingPage />

  const publicKey = config.public_key as string ?? ''

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-text-primary">Settings</h1>

      {/* Configuration */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Configuration</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text-primary">Data Directory</span>
              <p className="text-xs text-text-muted">{config.data_dir as string}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text-primary">Public Key</span>
              <div className="flex items-center gap-1 mt-0.5">
                <code className="text-xs font-mono text-text-secondary break-all">{publicKey || 'Not available'}</code>
                {publicKey && <CopyButton value={publicKey} />}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text-primary">Agent ID</span>
              <p className="text-xs text-text-muted">{config.agentId as string}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text-primary">Org ID</span>
              <p className="text-xs text-text-muted">{config.orgId as string}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-text-primary">Environment</span>
            </div>
            <select
              value={config.environment as string}
              onChange={e => handleSaveConfig('environment', e.target.value)}
              disabled={saving}
              className="px-3 py-1.5 text-sm border border-border rounded-md bg-bg-primary text-text-primary"
            >
              <option value="development">Development</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="test">Test</option>
            </select>
          </div>
        </div>
      </div>

      {/* Storage */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Storage</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total Receipts" value={formatNumber(config.receipt_count as number ?? 0)} icon={Database} />
            <StatCard label="Public Key" value={publicKey ? 'Available' : 'None'} icon={Key} />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => handleCleanup(false)}
              disabled={cleanupLoading}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium border border-danger/30 text-danger rounded-md hover:bg-danger-subtle transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {cleanupLoading ? 'Cleaning...' : 'Cleanup Expired'}
            </button>

            <button
              onClick={handleExportAll}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium border border-border text-text-secondary rounded-md hover:bg-bg-secondary transition-colors"
            >
              <Download className="w-4 h-4" />
              Export All
            </button>
          </div>

          {cleanupResult && (
            <div className="p-3 rounded-md bg-bg-secondary text-sm text-text-secondary">
              {cleanupResult.deleted > 0
                ? `Cleaned up ${cleanupResult.deleted} expired receipt${cleanupResult.deleted !== 1 ? 's' : ''}. ${cleanupResult.remaining} remaining.`
                : 'No expired receipts to clean up.'}
            </div>
          )}
        </div>
      </div>

      {/* Display */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Display</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Theme</span>
            <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
              {(['light', 'dark', 'system'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  className={cn(
                    'px-3 py-1.5 text-xs transition-colors',
                    theme === t ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-secondary'
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Auto-refresh</span>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAutoRefresh}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-md border transition-colors',
                  autoRefresh ? 'bg-success-subtle text-success border-success/30' : 'text-text-secondary border-border'
                )}
              >
                {autoRefresh ? 'On' : 'Off'}
              </button>
              {autoRefresh && (
                <select
                  value={interval}
                  onChange={e => setRefreshInterval(parseInt(e.target.value, 10))}
                  className="px-2 py-1.5 text-xs border border-border rounded-md bg-bg-primary text-text-primary"
                >
                  <option value="5000">5s</option>
                  <option value="10000">10s</option>
                  <option value="30000">30s</option>
                  <option value="60000">60s</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Public Key Sharing */}
      {publicKey && (
        <div className="card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-primary">Public Key Sharing</h3>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-text-muted">Share this key so others can verify your receipts:</p>
            <div className="p-3 bg-bg-secondary rounded-md font-mono text-xs text-text-secondary break-all">
              {publicKey}
            </div>
            <div className="flex items-center gap-2">
              <CopyButton value={publicKey} />
              <span className="text-xs text-text-muted">Copy Key</span>
            </div>
            <p className="text-xs text-text-muted">
              Host at: <code className="bg-bg-tertiary px-1 rounded">{process.env.NEXT_PUBLIC_APP_URL || 'yourdomain.com'}/.well-known/receipt-public-key.json</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
