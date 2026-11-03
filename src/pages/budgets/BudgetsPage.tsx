import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { budgetsApi, type BudgetInput } from '@/api/budgets'
import { getErrorMessage } from '@/api/client'
import { categoriesApi } from '@/api/categories'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { Progress } from '@/components/ui/Progress'
import { formatMonthYear, currentYearMonth } from '@/lib/date'
import type { Category } from '@/types'
import { useMobileAddForm } from '@/hooks/useMobileAddForm'
import { useToast } from '@/contexts/ToastContext'

const budgetSchema = z.object({
  amounts: z.record(z.string(), z.number().min(0).optional()),
})
type BudgetForm = z.infer<typeof budgetSchema>
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function BudgetsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const addForm = useMobileAddForm()
  const initial = currentYearMonth()
  const [month, setMonth] = useState(`${initial.year}-${String(initial.month).padStart(2, '0')}`)
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
    mutationFn: () => budgetsApi.copy({ fromYear: year, fromMonth: monthNumber, toYear: year, toMonth: monthNumber === 12 ? 1 : monthNumber + 1 }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['budget'] })
      setPageError('')
      showToast('Budget copied to next month.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  if (categoriesQuery.isLoading || budgetQuery.isLoading) return <LoadingState label="Loading budgets…" />
  if (categoriesQuery.isError || budgetQuery.isError || !categoriesQuery.data) return <div role="alert" className="text-sm text-[var(--danger)]">Budget data couldn’t be loaded.</div>

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
          <label htmlFor="budget-month" className="flex items-center gap-3 text-sm font-medium text-[var(--secondary)]">Month<input id="budget-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[var(--foreground)]" /></label>
          <Button type="button" variant="outline" size="icon" aria-label="Refresh budget actuals" title="Refresh budget actuals" onClick={() => void budgetQuery.refetch()} disabled={budgetQuery.isFetching}>
            <RefreshCw className={`h-4 w-4 ${budgetQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {budget ? <Card className="grid gap-4 p-5 sm:grid-cols-4">
        <div><p className="text-xs text-[var(--secondary)]">Budget</p><p className="mt-1 text-lg font-semibold">{currency.format(budget.summary.totalBudget)}</p></div>
        <div><p className="text-xs text-[var(--secondary)]">Spent</p><p className="mt-1 text-lg font-semibold">{currency.format(budget.summary.totalSpent)}</p></div>
        <div><p className="text-xs text-[var(--secondary)]">Remaining</p><p className="mt-1 text-lg font-semibold">{currency.format(budget.summary.remaining)}</p></div>
        <div><p className="text-xs text-[var(--secondary)]">Utilization</p><p className="mt-1 text-lg font-semibold">{budget.summary.utilizationPercent}%</p><Progress value={budget.summary.utilizationPercent} className="mt-2" /></div>
      </Card> : <p className="text-sm text-[var(--secondary)]">No budget is configured for {formatMonthYear(year, monthNumber)}.</p>}

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
                        {currency.format(item.actualSpent)} spent of {currency.format(item.budgetAmount)} · {item.utilizationPercent}% · {item.transactionCount} {item.transactionCount === 1 ? 'expense' : 'expenses'}
                      </p>
                      <Progress value={item.utilizationPercent} className="mt-2 max-w-md" />
                      <p className={`mt-1 text-xs ${item.overBudget > 0 ? 'text-[var(--danger)]' : 'text-[var(--secondary)]'}`}>
                        {item.overBudget > 0 ? `${currency.format(item.overBudget)} over budget` : `${currency.format(Math.max(0, item.remaining))} remaining`}
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