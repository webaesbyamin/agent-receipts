'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Receipt, Bot, Link2 } from 'lucide-react'
import { fetchSearch, type SearchResult } from '@/lib/api'
import { cn } from '@/lib/cn'
import { truncateId } from '@/lib/formatters'

interface SearchDialogProps {
  onClose: () => void
}

export function SearchDialog({ onClose }: SearchDialogProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetchSearch(query)
        setResults(res)
        setSelectedIndex(0)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const allItems = useCallback((): { type: string; label: string; sublabel: string; href: string }[] => {
    if (!results) return []
    const items: { type: string; label: string; sublabel: string; href: string }[] = []
    for (const r of results.receipts) {
      items.push({ type: 'receipt', label: truncateId(r.receipt_id), sublabel: `${r.action} — ${r.agent_id}`, href: `/receipts/${r.receipt_id}` })
    }
    for (const a of results.agents) {
      items.push({ type: 'agent', label: a, sublabel: 'Agent', href: `/agents/${a}` })
    }
    for (const c of results.chains) {
      items.push({ type: 'chain', label: truncateId(c), sublabel: 'Chain', href: `/chains/${c}` })
    }
    return items
  }, [results])

  const items = allItems()

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      router.push(items[selectedIndex].href)
      onClose()
    }
  }, [items, selectedIndex, router, onClose])

  const iconFor = (type: string) => {
    if (type === 'receipt') return Receipt
    if (type === 'agent') return Bot
    return Link2
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-bg-elevated border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search receipts, agents, chains..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center text-sm text-text-muted">Searching...</div>
        )}

        {!loading && items.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {items.map((item, i) => {
              const Icon = iconFor(item.type)
              return (
                <button
                  key={`${item.type}-${item.label}`}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors',
                    i === selectedIndex ? 'bg-primary-subtle text-primary' : 'text-text-secondary hover:bg-bg-secondary'
                  )}
                  onClick={() => { router.push(item.href); onClose() }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-xs truncate">{item.label}</div>
                    <div className="text-xs text-text-muted truncate">{item.sublabel}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!loading && query.trim() && items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-text-muted">No results found</div>
        )}

        {!query.trim() && (
          <div className="px-4 py-8 text-center text-sm text-text-muted">
            Type to search by receipt ID, agent, action, or chain
          </div>
        )}
      </div>
    </div>
  )
}
