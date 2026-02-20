import { truncateHash } from '@/lib/formatters'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/cn'

interface HashDisplayProps {
  hash: string
  length?: number
  className?: string
}

export function HashDisplay({ hash, length = 16, className }: HashDisplayProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <code className="font-mono text-xs text-text-secondary">{truncateHash(hash, length)}</code>
      <CopyButton value={hash} />
    </span>
  )
}
