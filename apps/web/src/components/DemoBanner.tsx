'use client'

export function DemoBanner() {
  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-sm text-amber-600 dark:text-amber-400">
      Demo mode — showing sample data.{' '}
      <a
        href="https://github.com/webaesbyamin/agent-receipts"
        className="underline font-medium"
        target="_blank"
        rel="noopener noreferrer"
      >
        Run locally with your own agents &rarr;
      </a>
    </div>
  )
}
