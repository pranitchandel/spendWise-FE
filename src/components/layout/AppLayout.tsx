import { Plus } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Header } from './Header'
import { MobileBottomNav } from './MobileBottomNav'
import { Sidebar } from './Sidebar'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transactions',
  '/transactions/new': 'New transaction',
  '/budgets': 'Budgets',
  '/lending': 'Lending & Borrowing',
  '/borrowing': 'Borrowing',
  '/statistics': 'Statistics',
  '/accounts': 'Accounts',
  '/recurring': 'Recurring',
  '/planned-expenses': 'Planned expenses',
  '/settings': 'Settings',
  '/settings/categories': 'Categories',
  '/settings/profile': 'Profile',
}

function resolveTitle(pathname: string) {
  if (titles[pathname]) return titles[pathname]
  if (pathname.startsWith('/transactions/')) return 'Transaction'
  if (pathname.startsWith('/budgets/')) return 'Budget'
  if (pathname.startsWith('/lending/')) return 'Lending detail'
  if (pathname.startsWith('/borrowing/')) return 'Borrowing detail'
  if (pathname.startsWith('/accounts/')) return 'Account'
  return 'SpendWise'
}

export function AppLayout() {
  const location = useLocation()
  const addTarget =
    location.pathname === '/dashboard' || location.pathname === '/transactions'
      ? '/transactions?add=1'
      : ['/accounts', '/budgets', '/lending', '/borrowing', '/recurring', '/planned-expenses'].includes(location.pathname)
        ? `${location.pathname}?add=1`
        : null
  const hideFab = !addTarget || location.pathname.startsWith('/transactions/new')

  return (
    <div className="flex min-h-dvh bg-[var(--background)]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={resolveTitle(location.pathname)} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 lg:px-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav />

      {!hideFab && addTarget ? (
        <Link
          to={addTarget}
          className={cn(
            'fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg transition hover:opacity-90 lg:bottom-8 lg:right-8',
          )}
          aria-label={
            location.pathname === '/accounts'
              ? 'Add account'
              : location.pathname === '/budgets'
                ? 'Add category budget'
                : location.pathname === '/recurring'
                  ? 'Add recurring schedule'
                  : location.pathname === '/planned-expenses'
                    ? 'Add planned expense'
                  : location.pathname === '/lending' || location.pathname === '/borrowing'
                    ? 'Add lending or borrowing record'
                    : 'Add transaction'
          }
        >
          <Plus className="h-6 w-6" />
        </Link>
      ) : null}
    </div>
  )
}
