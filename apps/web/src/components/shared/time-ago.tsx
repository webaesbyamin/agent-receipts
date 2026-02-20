'use client'

import { timeAgo, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/cn'

interface TimeAgoProps {
  date: string
  className?: string
}

export function TimeAgo({ date, className }: TimeAgoProps) {
  return (
    <time
      dateTime={date}
      title={formatDate(date)}
      className={cn('text-text-secondary', className)}
    >
      {timeAgo(date)}
    </time>
  )
}
