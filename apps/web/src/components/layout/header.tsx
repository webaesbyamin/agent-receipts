'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Sun, Moon, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { SearchDialog } from '@/components/shared/search-dialog'

export function Header() {
  const [dark, setDark] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { enabled: autoRefresh, toggle: toggleAutoRefresh } = useAutoRefresh()

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setDark(isDark)
  }, [])

  const toggleDark = useCallback(() => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {}
  }, [dark])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <header className="h-14 border-b border-border bg-bg-primary flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-bg-secondary text-text-muted text-sm hover:border-text-muted transition-colors max-w-md w-full md:w-80"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="truncate">Search receipts, agents, chains...</span>
          <kbd className="hidden md:inline-flex ml-auto text-xs border border-border rounded px-1.5 py-0.5 bg-bg-primary text-text-muted">
            {'\u2318'}K
          </kbd>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleAutoRefresh}
            className={cn(
              'p-2 rounded-md transition-colors',
              autoRefresh ? 'text-success hover:bg-success-subtle' : 'text-text-muted hover:bg-bg-tertiary'
            )}
            title={autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
          >
            <RefreshCw className={cn('w-4 h-4', autoRefresh && 'animate-spin')} style={autoRefresh ? { animationDuration: '3s' } : undefined} />
          </button>

          <button
            onClick={toggleDark}
            className="p-2 rounded-md text-text-muted hover:bg-bg-tertiary transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  )
}
