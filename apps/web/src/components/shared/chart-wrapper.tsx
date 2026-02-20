'use client'

import { cn } from '@/lib/cn'
import { LoadingSkeleton } from './loading'

interface ChartWrapperProps {
  title: string
  loading?: boolean
  children: React.ReactNode
  className?: string
}

export function ChartWrapper({ title, loading, children, className }: ChartWrapperProps) {
  return (
    <div className={cn('card p-4', className)}>
      <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">{title}</h3>
      {loading ? (
        <LoadingSkeleton className="h-48 w-full" />
      ) : (
        <div className="h-48">
          {children}
        </div>
      )}
    </div>
  )
}
