import { cn } from '@/lib/cn'

interface ConstraintBadgeProps {
  passed: number
  total: number
  className?: string
}

export function ConstraintBadge({ passed, total, className }: ConstraintBadgeProps) {
  if (total === 0) return <span className="text-text-muted text-xs">—</span>
  const allPassed = passed === total
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        allPassed ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger',
        className
      )}
    >
      {passed}/{total} {allPassed ? '\u2713' : '\u2717'}
    </span>
  )
}
