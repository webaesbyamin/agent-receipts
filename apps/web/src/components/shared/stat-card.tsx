import { cn } from '@/lib/cn'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: { value: number; label: string }
  className?: string
}

export function StatCard({ label, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('card p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-text-muted" />}
      </div>
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
      {trend && (
        <div className="mt-1 text-xs">
          <span className={cn(trend.value >= 0 ? 'text-success' : 'text-danger')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-text-muted ml-1">{trend.label}</span>
        </div>
      )}
    </div>
  )
}
