import {
  ArrowLeftRight,
  BarChart3,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  Repeat,
  Settings,
  Tags,
  Wallet,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/lending', label: 'Lending & Borrowing', icon: HandCoins },
  { to: '/statistics', label: 'Statistics', icon: BarChart3 },
  { to: '/accounts', label: 'Accounts', icon: CreditCard },
  { to: '/recurring', label: 'Recurring', icon: Repeat },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/settings/categories', label: 'Categories', icon: Tags },
]

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  return (
    <aside className={cn(
      'shrink-0 flex-col bg-[var(--sidebar)]',
      mobile
        ? 'flex h-full w-full'
        : 'hidden h-dvh w-64 border-r border-[var(--border)] lg:flex',
    )}>
      {!mobile ? (
        <div className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-bold text-white">
            SW
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">SpendWise</p>
            <p className="text-xs text-[var(--muted-foreground)]">Personal finance</p>
          </div>
        </div>
      ) : null}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/settings'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]'
                  : 'text-[var(--secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
              )
            }
          >
            <Icon className="h-4.5 w-4.5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
