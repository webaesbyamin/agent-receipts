import { cn } from '@/lib/cn'
import { STATUS_COLORS } from '@/lib/constants'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? { bg: 'bg-warning-subtle', text: 'text-warning', dot: 'bg-warning' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', colors.bg, colors.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
      {status}
    </span>
  )
}
