import { ArrowLeftRight, BarChart3, CalendarDays, HandCoins, Home, MoreHorizontal, Repeat, Settings, Wallet, X, CreditCard } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'

const items = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/lending', label: 'Lending', icon: HandCoins },
  { to: '/statistics', label: 'Statistics', icon: BarChart3 },
]

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const moreItems = [
    { to: '/accounts', label: 'Accounts', icon: CreditCard },
    { to: '/recurring', label: 'Recurring payments', icon: Repeat },
    { to: '/planned-expenses', label: 'Planned expenses', icon: CalendarDays },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]
  const moreActive = moreItems.some(({ to }) => location.pathname.startsWith(to))

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--nav)] pb-[env(safe-area-inset-bottom)] lg:hidden">
      {moreOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/20"
            aria-label="Close more navigation menu"
            onClick={() => setMoreOpen(false)}
          />
          <ul className="absolute bottom-full right-2 z-50 mb-2 w-60 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl">
            {moreItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex min-h-12 items-center gap-3 px-4 text-sm font-medium',
                    location.pathname.startsWith(to)
                      ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]'
                      : 'text-[var(--foreground)] hover:bg-[var(--muted)]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <ul className="grid grid-cols-6">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[9px] font-medium',
                  isActive ? 'text-[var(--primary)]' : 'text-[var(--secondary)]',
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{label}</span>
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-label={moreOpen ? 'Close more navigation menu' : 'Open more navigation menu'}
            aria-expanded={moreOpen}
            className={cn(
              'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[9px] font-medium',
              moreOpen || moreActive ? 'text-[var(--primary)]' : 'text-[var(--secondary)]',
            )}
          >
            {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
