'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/cn'

interface JsonViewerProps {
  data: unknown
  label?: string
  defaultExpanded?: boolean
  className?: string
}

export function JsonViewer({ data, label, defaultExpanded = false, className }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const jsonStr = JSON.stringify(data, null, 2)

  return (
    <div className={cn('card overflow-hidden', className)}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span className="font-medium">{label ?? 'View JSON'}</span>
        <CopyButton value={jsonStr} className="ml-auto" />
      </button>
      {expanded && (
        <pre className="px-4 py-3 border-t border-border overflow-x-auto text-xs font-mono text-text-secondary bg-bg-secondary max-h-96">
          {jsonStr}
        </pre>
      )}
    </div>
  )
}
