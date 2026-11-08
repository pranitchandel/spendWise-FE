import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, CalendarRange, CircleAlert } from 'lucide-react'
import { accountsApi } from '@/api/accounts'
import { budgetsApi } from '@/api/budgets'
import { plannedExpensesApi } from '@/api/plannedExpenses'
import { plannedIncomesApi } from '@/api/plannedIncomes'
import { Card } from '@/components/ui/Card'
import { CurrencyAmount } from '@/components/ui/CurrencyAmount'
import { LoadingState } from '@/components/ui/LoadingState'
import { currentYearMonth, formatDate, todayISO } from '@/lib/date'
import { buildPlannedCashflowForecast } from '@/lib/planned-cashflow'

export function PlannedCashflowPanel() {
  const [horizonMonths, setHorizonMonths] = useState(6)
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const incomesQuery = useQuery({ queryKey: ['planned-incomes'], queryFn: plannedIncomesApi.list })
  const expensesQuery = useQuery({ queryKey: ['planned-expenses'], queryFn: plannedExpensesApi.list })
  const { year: currentYear } = currentYearMonth()
  const budgetsQuery = useQuery({
    queryKey: ['cashflow-budgets', currentYear],
    queryFn: async () => {
      const [current, next] = await Promise.all([
        budgetsApi.listPage({ year: currentYear, page: 1, limit: 12 }),
        budgetsApi.listPage({ year: currentYear + 1, page: 1, limit: 12 }),
      ])
      return [...current.items, ...next.items]
    },
  })

  if (accountsQuery.isLoading || incomesQuery.isLoading || expensesQuery.isLoading || budgetsQuery.isLoading) return <LoadingState label="Building cash-flow forecast…" />
  if (accountsQuery.isError || incomesQuery.isError || expensesQuery.isError || budgetsQuery.isError || !accountsQuery.data || !incomesQuery.data || !expensesQuery.data || !budgetsQuery.data) {
    return <div role="alert" className="text-sm text-[var(--danger)]">Cash-flow forecast couldn’t be loaded.</div>
  }

  const accounts = accountsQuery.data.filter((account) => account.isActive && !account.isArchived)
  const forecast = buildPlannedCashflowForecast(accounts, incomesQuery.data, expensesQuery.data, budgetsQuery.data, todayISO(), horizonMonths)
  const plannedIncome = forecast.days.reduce((total, day) => total + day.income, 0)
  const plannedExpenses = forecast.campaignOutflow + forecast.budgetOutflow
  const lowestBalance = Math.min(forecast.startingBalance, ...forecast.days.map((day) => day.projectedBalance))
  const negativeAccounts = forecast.finalAccountBalances.filter((account) => account.balance < 0)
  const fieldClass = 'h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'

  return <section className="space-y-4" aria-label="Planned cash-flow forecast">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="text-lg font-semibold">Cash-flow forecast</h3><p className="mt-1 text-sm text-[var(--secondary)]">Starting from current account balances, planned income is added, dated campaign expenses are subtracted, and each month’s unspent budget is reserved.</p></div>
      <label className="flex items-center gap-2 text-sm font-medium" htmlFor="cashflow-horizon"><CalendarRange className="h-4 w-4" />Forecast
        <select id="cashflow-horizon" className={fieldClass} value={horizonMonths} onChange={(event) => setHorizonMonths(Number(event.target.value))}>
          <option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option>
        </select>
      </label>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Current account balances</p><p className="mt-2 text-xl font-semibold"><CurrencyAmount amount={forecast.startingBalance} /></p></Card>
      <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Planned income</p><p className="mt-2 flex items-center gap-2 text-xl font-semibold text-[var(--success)]"><ArrowDownLeft className="h-5 w-5 shrink-0" /><CurrencyAmount amount={plannedIncome} /></p></Card>
      <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Campaigns + budget reserve</p><p className="mt-2 flex items-center gap-2 text-xl font-semibold"><ArrowUpRight className="h-5 w-5 shrink-0" /><CurrencyAmount amount={plannedExpenses} /></p><p className="mt-1 text-xs text-[var(--secondary)]"><CurrencyAmount amount={forecast.campaignOutflow} /> campaigns · <CurrencyAmount amount={forecast.budgetOutflow} /> remaining budget</p></Card>
      <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Projected balance at horizon</p><p className={`mt-2 text-xl font-semibold ${forecast.endingBalance < 0 ? 'text-[var(--danger)]' : ''}`}><CurrencyAmount amount={forecast.endingBalance} /></p></Card>
    </div>

    {lowestBalance < 0 || negativeAccounts.length ? <div role="status" className="flex gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 text-sm text-[var(--danger)]"><CircleAlert className="h-4 w-4 shrink-0" /><span>The forecast falls below zero{negativeAccounts.length ? ` in ${negativeAccounts.map((account) => account.name).join(', ')}` : ''}. Review timing or account assignments.</span></div> : null}

    {forecast.unscheduledExpenses > 0 ? <p className="rounded-lg bg-[var(--muted)] p-3 text-xs leading-5 text-[var(--secondary)]"><CurrencyAmount amount={forecast.unscheduledExpenses} /> in planned expenses have no due date, so they are not placed on the timeline.</p> : null}
    {forecast.days.some((day) => day.entries.some((entry) => entry.direction === 'EXPENSE' && !entry.accountId)) ? <p className="rounded-lg bg-[var(--muted)] p-3 text-xs leading-5 text-[var(--secondary)]">Some dated expense estimates have no forecast account. They reduce the overall projected balance, but are not assigned to an individual account.</p> : null}

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--border)] p-4"><h4 className="font-semibold">Timeline</h4></div>
        {forecast.days.length ? <div className="overflow-x-auto">
          <div className="min-w-[620px]">
          <div className="grid grid-cols-[minmax(95px,0.7fr)_repeat(4,minmax(0,1fr))] gap-2 border-b border-[var(--border)] bg-[var(--muted)]/50 px-4 py-2 text-[10px] font-semibold uppercase text-[var(--secondary)] sm:text-xs">
            <span>Date</span><span>Income</span><span>Expenses</span><span>Net change</span><span className="text-right">Projected balance</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
          {forecast.days.map((day) => <details key={day.date} className="group px-4 py-3">
            <summary className="grid cursor-pointer list-none items-center gap-2 grid-cols-[minmax(95px,0.7fr)_repeat(4,minmax(0,1fr))]">
              <span className="text-sm font-medium">{formatDate(day.date)}</span>
              <span className="text-xs text-[var(--success)]">+<CurrencyAmount amount={day.income} /></span>
              <span className="text-xs">−<CurrencyAmount amount={day.expenses} /></span>
              <span className={`text-xs font-medium ${day.net < 0 ? 'text-[var(--danger)]' : ''}`}>{day.net >= 0 ? '+' : '−'}<CurrencyAmount amount={Math.abs(day.net)} /></span>
              <span className={`text-right text-sm font-semibold ${day.projectedBalance < 0 ? 'text-[var(--danger)]' : ''}`}><CurrencyAmount amount={day.projectedBalance} /></span>
            </summary>
            <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
              <ul className="space-y-2">{day.entries.map((entry, index) => <li key={`${entry.name}-${index}`} className="flex flex-wrap justify-between gap-2 text-xs"><span className="text-[var(--secondary)]">{entry.name}{entry.entryType === 'BUDGET' ? ' · budget reserve' : entry.accountName ? ` · ${entry.accountName}` : entry.direction === 'EXPENSE' ? ' · account not assigned' : ''}</span><span className={`font-medium ${entry.direction === 'INCOME' ? 'text-[var(--success)]' : ''}`}>{entry.direction === 'INCOME' ? '+' : '−'}<CurrencyAmount amount={entry.amount} /></span></li>)}</ul>
              <div className="grid grid-cols-1 gap-2">{day.accountBalances.map((account) => <div key={account.accountId} className="flex w-full justify-between gap-2 text-xs"><span className="text-[var(--secondary)]">{account.name} projected</span><span className={`shrink-0 font-medium ${account.balance < 0 ? 'text-[var(--danger)]' : ''}`}><CurrencyAmount amount={account.balance} /></span></div>)}</div>
            </div>
          </details>)}
          </div>
          </div>
        </div> : <p className="p-8 text-center text-sm text-[var(--secondary)]">No dated income or expenses in this forecast window.</p>}
      </Card>

      <Card className="p-4">
        <h4 className="font-semibold">Projected account balances</h4>
        <p className="mt-1 text-xs text-[var(--secondary)]">Current actual balance compared with the end of the selected forecast.</p>
        <div className="mt-3 divide-y divide-[var(--border)]">{accounts.map((account) => {
          const projected = forecast.finalAccountBalances.find((item) => item.accountId === account.id)?.balance ?? account.balance ?? 0
          return <div key={account.id} className="py-3"><p className="font-medium">{account.name}</p><div className="mt-2 flex justify-between gap-2 text-xs"><span className="text-[var(--secondary)]">Now</span><CurrencyAmount amount={account.balance ?? 0} /></div><div className="mt-1 flex justify-between gap-2 text-sm"><span className="text-[var(--secondary)]">At horizon</span><span className={projected < 0 ? 'font-semibold text-[var(--danger)]' : 'font-semibold'}><CurrencyAmount amount={projected} /></span></div></div>
        })}</div>
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs leading-5 text-[var(--secondary)]">Recorded transactions and budget actuals are already reflected. Each month uses its saved budget, or the current month’s category amounts when none exists; fallback months start with zero actual spend. Budget reserves are net of same-category campaign estimates to avoid double-counting. Category budgets are not assigned to a specific account. Forecasts do not change the ledger.</p>
      </Card>
    </div>
  </section>
}
