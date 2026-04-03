'use client'

export function DemoBanner() {
  return (
    <div className="w-full bg-amber-500/10 dark:bg-amber-500/20 border-b border-amber-500/30 dark:border-amber-400/30 px-4 py-2 text-center text-sm text-amber-700 dark:text-amber-300">
      Demo mode — showing sample data.{' '}
      <a
        href="/get-started"
        className="underline font-semibold text-amber-800 dark:text-amber-200"
      >
        Run locally with your own agents &rarr;
      </a>
    </div>
  )
}
