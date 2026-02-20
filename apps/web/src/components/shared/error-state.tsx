import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ message = 'Something went wrong', onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <AlertTriangle className="w-12 h-12 text-danger mb-4" />
      <h3 className="text-sm font-medium text-text-primary mb-1">Error</h3>
      <p className="text-sm text-text-muted max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}
