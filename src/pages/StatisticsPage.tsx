import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { transactionsApi } from '@/api/transactions'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { currentYearMonth, formatMonthYear } from '@/lib/date'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function recentMonths() {
  const current = currentYearMonth()
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(current.year, current.month - 1 - (5 - index), 1))
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
  })
}

export function StatisticsPage() {
  const months = recentMonths()
  const statsQuery = useQuery({
    queryKey: ['statistics', months.at(-1)?.year, months.at(-1)?.month],
    queryFn: async () => Promise.all(months.map(async ({ year, month }) => {
      const result = await transactionsApi.monthlySummary(year, month)
      return {
        label: formatMonthYear(year, month).slice(0, 3),
        year,
        month,
        income: result.totals.income ?? 0,
        expenses: result.totals.expense ?? 0,
        savings: result.totals.savings ?? 0,
      }
    })),
  })

  if (statsQuery.isLoading) return <LoadingState label="Loading statistics…" />
  if (statsQuery.isError || !statsQuery.data) return <div role="alert" className="text-sm text-[var(--danger)]">Statistics couldn’t be loaded.</div>

  const income = statsQuery.data.reduce((total, point) => total + point.income, 0)
  const expenses = statsQuery.data.reduce((total, point) => total + point.expenses, 0)
  const net = income - expenses
  const latest = statsQuery.data.at(-1)

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-medium text-[var(--primary)]">Actual ledger activity</p><h2 className="mt-1 text-2xl font-semibold">Statistics</h2><p className="mt-1 text-sm text-[var(--secondary)]">Monthly income and expense totals from the last six months.</p></div>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Six month totals">
        <Card className="p-5"><div className="flex items-center justify-between text-sm text-[var(--secondary)]"><span>Income</span><TrendingUp className="h-4 w-4 text-[var(--success)]" /></div><p className="mt-4 text-2xl font-semibold tabular-nums">{currency.format(income)}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between text-sm text-[var(--secondary)]"><span>Expenses</span><TrendingDown className="h-4 w-4 text-[var(--danger)]" /></div><p className="mt-4 text-2xl font-semibold tabular-nums">{currency.format(expenses)}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between text-sm text-[var(--secondary)]"><span>Income minus expenses</span><BarChart3 className="h-4 w-4 text-[var(--primary)]" /></div><p className="mt-4 text-2xl font-semibold tabular-nums">{currency.format(net)}</p></Card>
      </section>
      <Card className="p-4 sm:p-6">
        <div className="mb-5"><h3 className="font-semibold">Income vs expenses</h3><p className="mt-1 text-xs text-[var(--secondary)]">Each point is a complete calendar month.</p></div>
        <div className="h-72 w-full" role="img" aria-label="Bar chart comparing monthly income and expenses">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statsQuery.data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--secondary)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `₹${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`} />
              <Tooltip formatter={(value) => currency.format(Number(value))} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#16876a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#df674f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      {latest ? <Card className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 className="font-semibold">{formatMonthYear(latest.year, latest.month)}</h3><p className="mt-1 text-sm text-[var(--secondary)]">Monthly surplus: {currency.format(latest.savings)}</p></div><a href={`/transactions?from=${latest.year}-${String(latest.month).padStart(2, '0')}-01`} className="text-sm font-medium text-[var(--primary)] hover:underline">Open transaction ledger</a></Card> : null}
    </div>
  )
}