'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Receipt,
  Link2,
  Bot,
  CheckSquare,
  Scale,
  FileText,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
  BookOpen,
  Brain,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const NAV_ITEMS = [
  ...(isDemoMode ? [{ href: '/walkthrough', label: 'Try It', icon: Sparkles, accent: true }] : []),
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/receipts', label: 'Receipts', icon: Receipt },
  { href: '/chains', label: 'Chains', icon: Link2 },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/constraints', label: 'Constraints', icon: CheckSquare },
  { href: '/judgments', label: 'Judgments', icon: Scale },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/verify', label: 'Verify', icon: ShieldCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/how-it-works', label: 'How It Works', icon: BookOpen },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-bg-primary border-r border-border h-screen sticky top-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className={cn('flex items-center h-14 border-b border-border px-4', collapsed && 'justify-center px-2')}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <Database className="w-5 h-5 text-primary shrink-0" />
            <span className="font-semibold text-sm text-text-primary truncate">Agent Receipts</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/">
            <Database className="w-5 h-5 text-primary" />
          </Link>
        )}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = item.icon
          const hasAccent = 'accent' in item && item.accent
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2 mx-2 rounded-md text-sm transition-colors',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-primary-subtle text-primary font-medium'
                  : hasAccent
                    ? 'text-primary font-semibold hover:bg-primary-subtle'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-center h-10 border-t border-border text-text-muted hover:text-text-secondary transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
