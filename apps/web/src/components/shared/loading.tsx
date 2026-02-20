import { cn } from '@/lib/cn'

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-bg-tertiary rounded', className)} />
  )
}

export function LoadingCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4">
          <LoadingSkeleton className="h-3 w-16 mb-3" />
          <LoadingSkeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  )
}

export function LoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-border p-3">
        <LoadingSkeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 border-b border-border-subtle last:border-0">
          <LoadingSkeleton className="h-4 w-24" />
          <LoadingSkeleton className="h-4 w-32" />
          <LoadingSkeleton className="h-4 w-20" />
          <LoadingSkeleton className="h-4 w-16 ml-auto" />
        </div>
      ))}
    </div>
  )
}

export function LoadingPage() {
  return (
    <div className="space-y-6">
      <LoadingSkeleton className="h-8 w-48" />
      <LoadingCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LoadingTable />
        <LoadingTable />
      </div>
    </div>
  )
}
