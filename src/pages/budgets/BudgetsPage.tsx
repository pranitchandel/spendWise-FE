import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { budgetsApi, type BudgetInput } from '@/api/budgets'
import { getErrorMessage } from '@/api/client'
import { categoriesApi } from '@/api/categories'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CurrencyAmount } from '@/components/ui/CurrencyAmount'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { MobileFilterSheet } from '@/components/ui/MobileFilterSheet'
import { Progress } from '@/components/ui/Progress'
import { formatMonthYear, currentYearMonth } from '@/lib/date'
import type { Category } from '@/types'
import { useMobileAddForm } from '@/hooks/useMobileAddForm'
import { useToast } from '@/contexts/ToastContext'

const budgetSchema = z.object({
  amounts: z.record(z.string(), z.number().min(0).optional()),
})
type BudgetForm = z.infer<typeof budgetSchema>
export function BudgetsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const addForm = useMobileAddForm()
  const initial = currentYearMonth()
  const [month, setMonth] = useState(`${initial.year}-${String(initial.month).padStart(2, '0')}`)
  const [draftMonth, setDraftMonth] = useState(month)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [pageError, setPageError] = useState('')
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthNumber = Number(monthText)
  const categoriesQuery = useQuery({ queryKey: ['categories', 'EXPENSE'], queryFn: () => categoriesApi.list({ type: 'EXPENSE' }) })
  const budgetQuery = useQuery({
    queryKey: ['budget', year, monthNumber],
    queryFn: () => budgetsApi.getMonth(year, monthNumber),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const spendingQuery = useQuery({
    queryKey: ['budget-spending', year, monthNumber],
    queryFn: () => budgetsApi.getMonthlySpendingByCategory(year, monthNumber),
    refetchOnWindowFocus: true,
  })
  const form = useForm<BudgetForm>({ resolver: zodResolver(budgetSchema), defaultValues: { amounts: {} } })
  const budget = budgetQuery.data

  useEffect(() => {
    if (!budget || !categoriesQuery.data) return
    form.reset({ amounts: Object.fromEntries(categoriesQuery.data.map((category) => [category.id, budget.items.find((item) => item.categoryId === category.id)?.budgetAmount])) })
  }, [budget, categoriesQuery.data, form])

  const saveMutation = useMutation({
    mutationFn: async (input: BudgetInput) => budget
      ? budgetsApi.update(budget.id, { items: input.items })
      : budgetsApi.create(input),
    onSuccess: async () => {
      setPageError('')
      await queryClient.invalidateQueries({ queryKey: ['budget', year, monthNumber] })
      addForm.close()
      showToast(budget ? 'Budget updated.' : 'Budget created.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const copyMutation = useMutation({
    mutationFn: () => budgetsApi.copy({
      fromYear: year,
      fromMonth: monthNumber,
      toYear: monthNumber === 12 ? year + 1 : year,
      toMonth: monthNumber === 12 ? 1 : monthNumber + 1,
    }),
    onSuccess: async (copiedBudget) => {
      await queryClient.invalidateQueries({ queryKey: ['budget'] })
      setMonth(`${copiedBudget.year}-${String(copiedBudget.month).padStart(2, '0')}`)
      setDraftMonth(`${copiedBudget.year}-${String(copiedBudget.month).padStart(2, '0')}`)
      setPageError('')
      showToast('Budget copied to next month.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  if (categoriesQuery.isLoading || budgetQuery.isLoading || spendingQuery.isLoading) return <LoadingState label="Loading budgets…" />
  if (categoriesQuery.isError || budgetQuery.isError || spendingQuery.isError || !categoriesQuery.data || !spendingQuery.data) return <div role="alert" className="text-sm text-[var(--danger)]">Budget data couldn’t be loaded.</div>

  function submit(values: BudgetForm) {
    setPageError('')
    const items = Object.entries(values.amounts)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
      .map(([categoryId, amount]) => ({ categoryId, amount }))
    if (items.length === 0) {
      setPageError('Set a budget for at least one category. Leave other categories blank.')
      return
    }
    saveMutation.mutate({ year, month: monthNumber, items })
  }

  const categories: Category[] = categoriesQuery.data
  const fieldClass = 'h-10 w-32 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-right text-sm tabular-nums text-[var(--foreground)]'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--primary)]">Plan with intention</p><h2 className="mt-1 text-2xl font-semibold">Monthly budgets</h2></div>
        <div className="flex items-center gap-2">
          <Link className="hidden lg:block" to="/budgets?add=1"><Button><Plus className="h-4 w-4" />{budget ? 'Edit budget' : 'Set budget'}</Button></Link>
          <label htmlFor="budget-month-desktop" className="hidden items-center gap-3 text-sm font-medium text-[var(--secondary)] sm:flex">Month<input id="budget-month-desktop" type="month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)]" /></label>
          <Button type="button" className="hidden sm:inline-flex" disabled={!draftMonth || draftMonth === month} onClick={() => setMonth(draftMonth)}>Show results</Button>
          <Button type="button" variant="outline" size="icon" aria-label="Refresh budget actuals" title="Refresh budget actuals" onClick={() => void budgetQuery.refetch()} disabled={budgetQuery.isFetching}>
            <RefreshCw className={`h-4 w-4 ${budgetQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <MobileFilterSheet open={filtersOpen} onOpenChange={(open) => { if (open) setDraftMonth(month); setFiltersOpen(open) }} onApply={() => { if (draftMonth) setMonth(draftMonth) }} activeCount={1}>
        <label htmlFor="budget-month-mobile" className="block space-y-2 text-sm font-medium">Budget month<input id="budget-month-mobile" type="month" value={draftMonth} onChange={(event) => setDraftMonth(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)]" /></label>
      </MobileFilterSheet>

      {budget ? <Card className="grid gap-4 p-5 sm:grid-cols-4">
        <div><p className="text-xs text-[var(--secondary)]">Budget</p><p className="mt-1 text-lg font-semibold"><CurrencyAmount amount={budget.summary.totalBudget} minimumFractionDigits={0} maximumFractionDigits={0} /></p></div>
        <div><p className="text-xs text-[var(--secondary)]">Spent</p><p className="mt-1 text-lg font-semibold"><CurrencyAmount amount={budget.summary.totalSpent} minimumFractionDigits={0} maximumFractionDigits={0} /></p></div>
        <div><p className="text-xs text-[var(--secondary)]">Remaining</p><p className="mt-1 text-lg font-semibold"><CurrencyAmount amount={budget.summary.remaining} minimumFractionDigits={0} maximumFractionDigits={0} /></p></div>
        <div><p className="text-xs text-[var(--secondary)]">Utilization</p><p className="mt-1 text-lg font-semibold">{budget.summary.utilizationPercent}%</p><Progress value={budget.summary.utilizationPercent} className="mt-2" /></div>
      </Card> : <p className="text-sm text-[var(--secondary)]">No budget is configured for {formatMonthYear(year, monthNumber)}.</p>}

      <section className="space-y-3" aria-label="Spending by category">
        <div>
          <h3 className="font-semibold">Spending by category</h3>
          <p className="mt-1 text-xs text-[var(--secondary)]">Expense activity for {formatMonthYear(year, monthNumber)}, including categories without a budget.</p>
        </div>
        {spendingQuery.data.length ? (
          <Card className="divide-y divide-[var(--border)] overflow-hidden p-0">
            {spendingQuery.data.map((spending) => {
              const budgetItem = budget?.items.find((item) => item.categoryId === spending.categoryId)
              const highestSpend = spendingQuery.data[0]?.actualSpent ?? 0
              const barPercent = budgetItem
                ? Math.max(0, Math.min(budgetItem.utilizationPercent, 100))
                : highestSpend > 0 ? Math.max(0, Math.min((spending.actualSpent / highestSpend) * 100, 100)) : 0
              return (
                <div key={spending.categoryId} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: spending.color }} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{spending.categoryName}{spending.isArchived ? ' · Archived' : ''}</p>
                        <p className="mt-0.5 text-xs text-[var(--secondary)]">{spending.transactionCount} {spending.transactionCount === 1 ? 'expense' : 'expenses'}{budgetItem ? ` · ${budgetItem.utilizationPercent}% of budget` : ' · Relative to highest category'}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold"><CurrencyAmount amount={spending.actualSpent} minimumFractionDigits={0} maximumFractionDigits={0} /></p>
                  </div>
                  <div
                    className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]"
                    role="progressbar"
                    aria-label={`${spending.categoryName} spending${budgetItem ? ' budget usage' : ' relative to highest category'}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(barPercent)}
                  >
                    <div className="h-full rounded-full transition-all" style={{ width: `${barPercent}%`, backgroundColor: spending.color }} />
                  </div>
                </div>
              )
            })}
          </Card>
        ) : (
          <Card className="p-6 text-center text-sm text-[var(--secondary)]">No expense activity for this month.</Card>
        )}
      </section>

      <Modal open={addForm.isOpen} onClose={addForm.close} title="Category limits" className="sm:max-w-3xl">
        <p className="mb-4 text-xs text-[var(--secondary)]">Each month has independent limits; actual spending comes from expense and refund transactions.</p>
        <form onSubmit={form.handleSubmit(submit)}>
          <div className="divide-y divide-[var(--border)]">
            {categories.map((category) => {
              const item = budget?.items.find((entry) => entry.categoryId === category.id)
              return <div key={category.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{category.name}</p>
                  {item ? (
                    <>
                      <p className="mt-1 text-xs text-[var(--secondary)]">
                        <CurrencyAmount amount={item.actualSpent} minimumFractionDigits={0} maximumFractionDigits={0} /> spent of <CurrencyAmount amount={item.budgetAmount} minimumFractionDigits={0} maximumFractionDigits={0} /> · {item.utilizationPercent}% · {item.transactionCount} {item.transactionCount === 1 ? 'expense' : 'expenses'}
                      </p>
                      <Progress value={item.utilizationPercent} className="mt-2 max-w-md" />
                      <p className={`mt-1 text-xs ${item.overBudget > 0 ? 'text-[var(--danger)]' : 'text-[var(--secondary)]'}`}>
                        {item.overBudget > 0 ? <><CurrencyAmount amount={item.overBudget} minimumFractionDigits={0} maximumFractionDigits={0} /> over budget</> : <><CurrencyAmount amount={Math.max(0, item.remaining)} minimumFractionDigits={0} maximumFractionDigits={0} /> remaining</>}
                      </p>
                    </>
                  ) : <p className="mt-1 text-xs text-[var(--secondary)]">No limit set</p>}
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--secondary)]" htmlFor={`budget-${category.id}`}>₹<input id={`budget-${category.id}`} type="number" min="0.01" step="0.01" placeholder="No limit" className={fieldClass} {...form.register(`amounts.${category.id}`, { setValueAs: (value: string) => value === '' ? undefined : Number(value) })} /></label>
              </div>
            })}
          </div>
          {pageError ? <p role="alert" className="px-5 pt-4 text-sm text-[var(--danger)]">{pageError}</p> : null}
          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border)] px-5 py-4">
            {budget ? <Button type="button" variant="outline" onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending}><Copy className="h-4 w-4" />Copy to next month</Button> : null}
            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : budget ? 'Save budget' : 'Create budget'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}