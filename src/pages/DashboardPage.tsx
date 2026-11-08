import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { accountsApi } from '@/api/accounts'
import { transactionsApi } from '@/api/transactions'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CurrencyAmount } from '@/components/ui/CurrencyAmount'
import { LoadingState } from '@/components/ui/LoadingState'
import { MobileFilterSheet } from '@/components/ui/MobileFilterSheet'
import { formatDate } from '@/lib/date'

function currentMonth() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date())
}

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth)
  const [draftMonth, setDraftMonth] = useState(currentMonth)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthNumber = Number(monthText)
  const summaryQuery = useQuery({
    queryKey: ['monthly-summary', year, monthNumber],
    queryFn: () => transactionsApi.monthlySummary(year, monthNumber),
  })
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const recentQuery = useQuery({
    queryKey: ['recent-transactions', year, monthNumber],
    queryFn: () => transactionsApi.list({ page: 1, limit: 6, from: `${month}-01` }),
  })

  if (summaryQuery.isLoading || accountsQuery.isLoading || recentQuery.isLoading) {
    return <LoadingState label="Loading your finances…" />
  }
  if (summaryQuery.isError || accountsQuery.isError || recentQuery.isError) {
    return <div role="alert" className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--danger)]">Your dashboard couldn’t be loaded. Refresh to try again.</div>
  }
  if (!summaryQuery.data || !accountsQuery.data || !recentQuery.data) {
    return <LoadingState label="Loading your finances…" />
  }

  const totals = summaryQuery.data.totals
  const accountTotal = accountsQuery.data.reduce((total, account) => total + (account.balance ?? account.openingBalance), 0)
  const cards = [
    { label: 'Income', value: totals.income ?? 0, icon: ArrowDownLeft, tone: 'text-[var(--success)]' },
    { label: 'Expenses', value: totals.expense ?? 0, icon: ArrowUpRight, tone: 'text-[var(--danger)]' },
    { label: 'Income minus expenses', value: totals.savings ?? 0, icon: Wallet, tone: 'text-[var(--foreground)]' },
    { label: 'Account balances', value: accountTotal, icon: Landmark, tone: 'text-[var(--foreground)]' },
  ]

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--primary)]">Financial overview</p>
          <h2 className="mt-1 text-2xl font-semibold">Your money at a glance</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-3 text-sm font-medium text-[var(--secondary)] sm:flex" htmlFor="dashboard-month-desktop">Month
            <input id="dashboard-month-desktop" type="month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)]" />
          </label>
          <Button type="button" className="hidden sm:inline-flex" disabled={!draftMonth || draftMonth === month} onClick={() => setMonth(draftMonth)}>Show results</Button>
          <Link className="hidden lg:block" to="/transactions?add=1"><Button><ArrowDownLeft className="h-4 w-4" />Add transaction</Button></Link>
        </div>
      </div>
      <MobileFilterSheet open={filtersOpen} onOpenChange={(open) => { if (open) setDraftMonth(month); setFiltersOpen(open) }} onApply={() => { if (draftMonth) setMonth(draftMonth) }} activeCount={1}>
        <label className="block space-y-2 text-sm font-medium" htmlFor="dashboard-month-mobile">Dashboard month
          <input id="dashboard-month-mobile" type="month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)]" />
        </label>
      </MobileFilterSheet>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Monthly financial totals">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="flex min-h-32 flex-col justify-between p-5">
            <div className="flex items-center justify-between text-sm text-[var(--secondary)]"><span>{label}</span><Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" /></div>
            <p className={`mt-5 text-2xl font-semibold ${tone}`}><CurrencyAmount amount={value} minimumFractionDigits={0} maximumFractionDigits={0} /></p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div><h3 className="font-semibold">Recent activity</h3><p className="mt-1 text-xs text-[var(--secondary)]">{summaryQuery.data.transactionCount} transactions this month</p></div>
            <a href="/transactions" className="text-sm font-medium text-[var(--primary)] hover:underline">View all</a>
          </div>
          {recentQuery.data.items.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {recentQuery.data.items.map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{transaction.description || transaction.type.replaceAll('_', ' ').toLowerCase()}</p><p className="mt-1 text-xs text-[var(--secondary)]">{formatDate(transaction.transactionDate)} · {transaction.paymentMode.replaceAll('_', ' ')}</p></div>
                  <span className={`shrink-0 text-sm font-semibold ${transaction.type === 'INCOME' || transaction.type === 'REFUND' ? 'text-[var(--success)]' : 'text-[var(--foreground)]'}`}>{transaction.type === 'INCOME' || transaction.type === 'REFUND' ? '+' : '−'}<CurrencyAmount amount={transaction.amount} minimumFractionDigits={0} maximumFractionDigits={0} /></span>
                </li>
              ))}
            </ul>
          ) : <div className="px-5 py-12 text-center text-sm text-[var(--secondary)]">No transactions recorded for this month.</div>}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Accounts</h3>
          <p className="mt-1 text-xs text-[var(--secondary)]">Balances are separate from monthly savings.</p>
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {accountsQuery.data.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{account.name}</p><p className="mt-0.5 text-xs text-[var(--secondary)]">{account.type.replaceAll('_', ' ')}</p></div>
                <span className="shrink-0 text-sm font-semibold"><CurrencyAmount amount={account.balance ?? account.openingBalance} minimumFractionDigits={0} maximumFractionDigits={0} /></span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}