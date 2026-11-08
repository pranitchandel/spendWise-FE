import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, ChevronDown, ChevronUp, EllipsisVertical, Pencil, Plus, RotateCcw, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { accountsApi } from '@/api/accounts'
import { getErrorMessage } from '@/api/client'
import { categoriesApi } from '@/api/categories'
import { savingsApi, type SavingsGoalInput, type SavingsMovementInput } from '@/api/savings'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CurrencyAmount } from '@/components/ui/CurrencyAmount'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { useToast } from '@/contexts/ToastContext'
import { useMobileAddForm } from '@/hooks/useMobileAddForm'
import { formatDate, todayISO } from '@/lib/date'
import type { SavingsGoal, SavingsGoalStatus, SavingsOptionType } from '@/types'
import { SavingsPlanner } from './SavingsPlanner'

const optionTypes = ['BANK_SAVINGS', 'RECURRING_DEPOSIT', 'FIXED_DEPOSIT', 'PPF', 'MUTUAL_FUND', 'OTHER'] as const
const compoundingFrequencies = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'] as const
const paymentModes = ['UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'NET_BANKING', 'OTHER'] as const
const goalSchema = z.object({
  name: z.string().trim().min(1, 'Enter a savings goal name'),
  targetAmount: z.number().positive('Target must be greater than zero'),
  targetDate: z.string().min(1, 'Choose a target date'),
  notes: z.string().max(2000).optional(),
  allocations: z.array(z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1, 'Name this allocation'),
    optionType: z.enum(optionTypes),
    expectedAnnualReturnRate: z.number().min(0).max(100),
    compoundingFrequency: z.enum(compoundingFrequencies),
    monthlyContribution: z.number().min(0),
  })).min(1, 'Add at least one savings allocation'),
})
const movementSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  transactionDate: z.string().min(1),
  counterpartAccountId: z.string().min(1, 'Choose the other account'),
  paymentMode: z.enum(paymentModes),
  note: z.string().max(2000).optional(),
})
type GoalForm = z.infer<typeof goalSchema>
type MovementForm = z.infer<typeof movementSchema>
type MovementTarget = { goal: SavingsGoal; allocationId: string; allocationName: string; direction: 'DEPOSIT' | 'WITHDRAWAL' }
const optionLabels: Record<SavingsOptionType, string> = {
  BANK_SAVINGS: 'Bank savings',
  RECURRING_DEPOSIT: 'Recurring deposit',
  FIXED_DEPOSIT: 'Fixed deposit',
  PPF: 'PPF',
  MUTUAL_FUND: 'Mutual fund',
  OTHER: 'Other',
}
const statusTabs: Array<{ value: SavingsGoalStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export function SavingsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const addForm = useMobileAddForm()
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [activeStatus, setActiveStatus] = useState<SavingsGoalStatus>('ACTIVE')
  const [activeView, setActiveView] = useState<'goals' | 'planner'>('goals')
  const [goalPage, setGoalPage] = useState(1)
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())
  const [goalActionsId, setGoalActionsId] = useState<string | null>(null)
  const [movementTarget, setMovementTarget] = useState<MovementTarget | null>(null)
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null)
  const goalsQuery = useQuery({
    queryKey: ['savings', activeStatus, goalPage],
    queryFn: () => savingsApi.listPage({ status: activeStatus, page: goalPage, limit: 20 }),
    placeholderData: (previous) => previous,
  })
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const transferCategoriesQuery = useQuery({
    queryKey: ['categories', 'TRANSFER'],
    queryFn: () => categoriesApi.list({ type: 'TRANSFER' }),
  })
  const goalForm = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: '', targetAmount: 0, targetDate: '', notes: '',
      allocations: [{ name: '', optionType: 'BANK_SAVINGS', expectedAnnualReturnRate: 0, compoundingFrequency: 'MONTHLY', monthlyContribution: 0 }],
    },
  })
  const allocationFields = useFieldArray({ control: goalForm.control, name: 'allocations' })
  const movementForm = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { amount: 0, transactionDate: todayISO(), counterpartAccountId: '', paymentMode: 'UPI', note: '' },
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['savings'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }
  const saveMutation = useMutation({
    mutationFn: (input: SavingsGoalInput) => editingGoal
      ? savingsApi.update(editingGoal.id, input)
      : savingsApi.create(input),
    onSuccess: async () => {
      await refresh()
      closeGoalForm()
      showToast(editingGoal ? 'Savings goal updated.' : 'Savings goal created.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const statusMutation = useMutation({
    mutationFn: ({ goal, status }: { goal: SavingsGoal; status: SavingsGoalStatus }) => savingsApi.update(goal.id, { status }),
    onSuccess: async (_updated, variables) => {
      await refresh()
      setGoalActionsId(null)
      showToast(
        variables.status === 'ACTIVE'
          ? 'Savings goal reopened.'
          : variables.status === 'PAUSED'
            ? 'Savings contributions paused.'
            : variables.status === 'COMPLETED'
              ? 'Savings goal completed.'
              : 'Savings goal archived.',
        'success',
      )
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const movementMutation = useMutation({
    mutationFn: ({ target, values }: { target: MovementTarget; values: MovementForm }) => {
      const allocation = target.goal.allocations.find((item) => item.id === target.allocationId)
      const transferCategoryId = transferCategoriesQuery.data?.[0]?.id
      if (!allocation || !transferCategoryId) throw new Error('Savings allocation or transfer category is unavailable')
      const input: SavingsMovementInput = {
        direction: target.direction,
        amount: values.amount,
        transactionDate: values.transactionDate,
        counterpartAccountId: values.counterpartAccountId,
        paymentMode: values.paymentMode,
        categoryId: transferCategoryId,
        note: values.note?.trim() || undefined,
      }
      return savingsApi.recordMovement(target.goal.id, target.allocationId, input)
    },
    onSuccess: async (_updated, variables) => {
      await refresh()
      setMovementTarget(null)
      showToast(variables.target.direction === 'DEPOSIT' ? 'Savings deposit recorded as a transfer.' : 'Savings withdrawal recorded as a transfer.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: (goal: SavingsGoal) => savingsApi.remove(goal.id),
    onSuccess: async () => {
      await refresh()
      setGoalToDelete(null)
      showToast('Savings goal deleted.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  if (goalsQuery.isLoading || accountsQuery.isLoading || transferCategoriesQuery.isLoading) {
    return <LoadingState label="Loading savings goals…" />
  }
  if (goalsQuery.isError || accountsQuery.isError || transferCategoriesQuery.isError || !goalsQuery.data || !accountsQuery.data || !transferCategoriesQuery.data) {
    return <div role="alert" className="text-sm text-[var(--danger)]">Savings data couldn’t be loaded.</div>
  }

  const goals = goalsQuery.data.items
  const activeGoals = goals.filter((goal) => goal.status === 'ACTIVE')
  const totals = activeGoals.reduce((sum, goal) => ({
    current: sum.current + goal.currentBalance,
    projected: sum.projected + goal.projectedBalance,
    monthly: sum.monthly + goal.monthlyContribution,
  }), { current: 0, projected: 0, monthly: 0 })
  const visibleGoals = goals.filter((goal) => goal.status === activeStatus)
  const activeAccounts = accountsQuery.data.filter((account) => !account.isArchived && account.isActive)
  const availableCounterpartAccounts = activeAccounts
  function emptyGoalForm(): GoalForm {
    return {
      name: '', targetAmount: 0, targetDate: '', notes: '',
      allocations: [{ name: '', optionType: 'BANK_SAVINGS', expectedAnnualReturnRate: 0, compoundingFrequency: 'MONTHLY', monthlyContribution: 0 }],
    }
  }

  function closeGoalForm() {
    addForm.close()
    setEditingGoal(null)
    goalForm.reset(emptyGoalForm())
  }

  function openAddGoal() {
    setEditingGoal(null)
    goalForm.reset(emptyGoalForm())
  }

  function openEditGoal(goal: SavingsGoal) {
    setEditingGoal(goal)
    addForm.close()
    goalForm.reset({
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      notes: goal.notes,
      allocations: goal.allocations.map((allocation) => ({
        id: allocation.id,
        name: allocation.name,
        optionType: allocation.optionType,
        expectedAnnualReturnRate: allocation.expectedAnnualReturnRate,
        compoundingFrequency: allocation.compoundingFrequency,
        monthlyContribution: allocation.monthlyContribution,
      })),
    })
  }

  function submitGoal(values: GoalForm) {
    saveMutation.mutate({ ...values, notes: values.notes?.trim() || '' })
  }

  function openMovement(goal: SavingsGoal, allocationId: string, allocationName: string, direction: 'DEPOSIT' | 'WITHDRAWAL') {
    movementForm.reset({ amount: 0, transactionDate: todayISO(), counterpartAccountId: '', paymentMode: 'UPI', note: '' })
    setMovementTarget({ goal, allocationId, allocationName, direction })
  }

  function toggleExpanded(goalId: string) {
    setExpandedGoals((current) => {
      const next = new Set(current)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return next
    })
  }

  function submitMovement(values: MovementForm) {
    if (movementTarget) movementMutation.mutate({ target: movementTarget, values })
  }

  function hasTransferHistory(goal: SavingsGoal) {
    return goal.allocations.some((allocation) => allocation.movements.length > 0)
  }

  const fieldClass = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'
  const cards = [
    { label: 'Actually saved', amount: totals.current },
    { label: 'Projected at targets', amount: totals.projected },
    { label: 'Planned monthly saving', amount: totals.monthly },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--primary)]">Recorded savings and estimated growth</p><h2 className="mt-1 text-2xl font-semibold">Savings goals</h2></div>
        <Link className="hidden lg:block" to="/savings?add=1" onClick={openAddGoal}><Button><Plus className="h-4 w-4" />Create goal</Button></Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" aria-label="Active savings summary">
        {cards.map((card) => <Card key={card.label} className="p-4"><p className="text-sm text-[var(--secondary)]">{card.label}</p><p className="mt-2 text-xl font-semibold"><CurrencyAmount amount={card.amount} /></p></Card>)}
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:items-start">
        <div className="flex w-full gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1 sm:inline-flex sm:w-auto" role="tablist" aria-label="Savings views">
          <button type="button" role="tab" aria-selected={activeView === 'goals'} onClick={() => setActiveView('goals')} className={`flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeView === 'goals' ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-[var(--card)]/60 text-[var(--secondary)] hover:text-[var(--foreground)]'}`}>Goals</button>
          <button type="button" role="tab" aria-selected={activeView === 'planner'} onClick={() => setActiveView('planner')} className={`flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeView === 'planner' ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-[var(--card)]/60 text-[var(--secondary)] hover:text-[var(--foreground)]'}`}>Planner</button>
        </div>
        {activeView === 'goals' ? <select aria-label="Savings goal status" className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium text-[var(--foreground)] sm:hidden" value={activeStatus} onChange={(event) => { setActiveStatus(event.target.value as SavingsGoalStatus); setGoalPage(1) }}>{statusTabs.map((tab) => <option key={tab.value} value={tab.value}>{tab.label}</option>)}</select> : null}
        {activeView === 'goals' ? <div className="hidden max-w-full rounded-lg gap-1 sm:inline-flex border border-[var(--border)] bg-[var(--muted)] p-1" role="tablist" aria-label="Savings goal status">
          {statusTabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeStatus === tab.value} onClick={() => { setActiveStatus(tab.value); setGoalPage(1) }} className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeStatus === tab.value ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-[var(--card)]/60 text-[var(--secondary)] hover:text-[var(--foreground)]'}`}>{tab.label}</button>)}
        </div> : null}
      </div>

      {activeView === 'planner' ? <SavingsPlanner goals={goals} /> : <>

      <section className="space-y-3" aria-label={`${activeStatus.toLowerCase()} savings goals`}>
        {visibleGoals.length ? visibleGoals.map((goal) => {
          const expanded = expandedGoals.has(goal.id)
          const goalActionsOpen = goalActionsId === goal.id
          return <Card key={goal.id} className="relative overflow-visible p-0">
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]"><Target className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{goal.name}</h3><p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--secondary)]"><span className="whitespace-nowrap">Target {formatDate(goal.targetDate)}</span><span className="hidden sm:inline">·</span><span className="whitespace-nowrap">{goal.allocations.length} {goal.allocations.length === 1 ? 'allocation' : 'allocations'}</span><span className="hidden sm:inline">·</span><span className="whitespace-nowrap">{goal.monthsUntilTarget} months</span></p>{goal.notes ? <p className="mt-2 text-sm text-[var(--secondary)]">{goal.notes}</p> : null}</div>
                </div>
                <div className="relative shrink-0">
                  <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Actions for ${goal.name}`} aria-expanded={goalActionsOpen} aria-haspopup="menu" onClick={() => setGoalActionsId((current) => current === goal.id ? null : goal.id)}><EllipsisVertical className="h-5 w-5" /></Button>
                  {goalActionsOpen ? <div role="menu" className="absolute right-0 top-full z-50 mt-1 flex w-52 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
                    {goal.status === 'ACTIVE' ? <>
                      <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" onClick={() => { setGoalActionsId(null); openEditGoal(goal) }}><Pencil className="h-4 w-4" />Edit goal</Button>
                      <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ goal, status: 'PAUSED' })}><RotateCcw className="h-4 w-4" />Pause contributions</Button>
                      <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ goal, status: 'COMPLETED' })}><CheckCircle2 className="h-4 w-4 text-[var(--success)]" />Mark completed</Button>
                      <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ goal, status: 'ARCHIVED' })}><Archive className="h-4 w-4" />Archive goal</Button>
                      <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3 text-[var(--danger)]" disabled={hasTransferHistory(goal)} title={hasTransferHistory(goal) ? 'Goals with transfer history cannot be deleted; archive this goal instead' : undefined} onClick={() => { setGoalActionsId(null); setGoalToDelete(goal) }}><Trash2 className="h-4 w-4" />Delete goal</Button>
                    </> : <>
                      <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ goal, status: 'ACTIVE' })}><RotateCcw className="h-4 w-4" />Reopen goal</Button>
                      {goal.status === 'PAUSED' ? <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ goal, status: 'ARCHIVED' })}><Archive className="h-4 w-4" />Archive goal</Button> : null}
                    </>}
                  </div> : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
                <div className="min-w-0"><p className="truncate text-[11px] text-[var(--secondary)]">Saved</p><p className="mt-1 text-xs font-semibold sm:text-sm"><CurrencyAmount amount={goal.currentBalance} /></p></div>
                <div className="min-w-0"><p className="truncate text-[11px] text-[var(--secondary)]">Projected</p><p className="mt-1 text-xs font-semibold sm:text-sm"><CurrencyAmount amount={goal.projectedBalance} /></p></div>
                <div className="min-w-0"><p className="truncate text-[11px] text-[var(--secondary)]">Target</p><p className="mt-1 text-xs font-semibold sm:text-sm"><CurrencyAmount amount={goal.targetAmount} /></p></div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]" role="progressbar" aria-label={`${goal.name} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, goal.progressPercent)}><div className={`h-full rounded-full ${goal.progressPercent > 100 ? 'bg-[var(--success)]' : 'bg-[var(--primary)]'}`} style={{ width: `${Math.min(100, goal.progressPercent)}%` }} /></div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="min-w-0 text-xs text-[var(--secondary)]"><span className="whitespace-nowrap">{goal.progressPercent}% of target</span> · <span className="whitespace-nowrap"><CurrencyAmount amount={goal.targetGap} /> {goal.targetGap >= 0 ? 'to go' : 'above target'}</span></p>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={expanded ? 'Hide allocations' : 'View allocations'} title={expanded ? 'Hide allocations' : 'View allocations'} aria-expanded={expanded} onClick={() => toggleExpanded(goal.id)}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
              </div>
            </div>

            {expanded ? <div className="border-t border-[var(--border)]">
              {goal.allocations.map((allocation) => <div key={allocation.id} className="border-b border-[var(--border)] px-4 py-4 last:border-b-0 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h4 className="font-medium">{allocation.name}</h4><p className="mt-1 text-xs text-[var(--secondary)]">{optionLabels[allocation.optionType]}</p></div>
                  {goal.status === 'ACTIVE' ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openMovement(goal, allocation.id, allocation.name, 'DEPOSIT')}><ArrowDownToLine className="h-4 w-4" />Add</Button><Button size="sm" variant="ghost" onClick={() => openMovement(goal, allocation.id, allocation.name, 'WITHDRAWAL')} disabled={allocation.currentBalance <= 0}><ArrowUpFromLine className="h-4 w-4" />Withdraw</Button></div> : null}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <div><p className="text-xs text-[var(--secondary)]">Recorded balance</p><p className="mt-1 text-sm font-semibold"><CurrencyAmount amount={allocation.currentBalance} /></p></div>
                  <div><p className="text-xs text-[var(--secondary)]">Estimated value</p><p className="mt-1 text-sm font-semibold"><CurrencyAmount amount={allocation.projectedBalance} /></p></div>
                  <div><p className="text-xs text-[var(--secondary)]">Monthly contribution</p><p className="mt-1 text-sm font-semibold"><CurrencyAmount amount={allocation.monthlyContribution} /></p></div>
                  <div><p className="text-xs text-[var(--secondary)]">Assumed return</p><p className="mt-1 text-sm font-semibold tabular-nums">{allocation.expectedAnnualReturnRate}% p.a.</p></div>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[var(--secondary)]">Projection assumes {allocation.compoundingFrequency.toLowerCase().replaceAll('_', ' ')} compounding and month-end contributions. Return is an estimate, not guaranteed.</p>
                <details className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium">Show rough calculation</summary>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-[var(--secondary)]">Recorded in this goal</span><CurrencyAmount amount={allocation.currentBalance} className="text-right font-medium" /></div>
                    <div className="flex justify-between gap-3"><span className="text-[var(--secondary)]">Planned contributions (<CurrencyAmount amount={allocation.monthlyContribution} /> × {goal.monthsUntilTarget} months)</span><CurrencyAmount amount={allocation.projectedContributions} className="text-right font-medium" /></div>
                    <div className="flex justify-between gap-3"><span className="text-[var(--secondary)]">Estimated growth</span><CurrencyAmount amount={allocation.projectedGrowth} className="text-right font-medium" /></div>
                    <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-2"><span className="font-semibold">Estimated value</span><CurrencyAmount amount={allocation.projectedBalance} className="text-right font-semibold" /></div>
                    <p className="leading-5 text-[var(--secondary)]">Each month, the current amount is increased by an estimated monthly return, then the planned contribution is added. The monthly rate is derived from {allocation.expectedAnnualReturnRate}% annual return with {allocation.compoundingFrequency.toLowerCase().replaceAll('_', ' ')} compounding. Only recorded transfers count as saved; planned amounts and returns do not change account balances.</p>
                  </div>
                </details>
                {allocation.movements.length ? <ul className="mt-3 divide-y divide-[var(--border)] border-l-2 border-[var(--border)] pl-3">{allocation.movements.map((movement) => <li key={movement.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span className="text-[var(--secondary)]">{formatDate(movement.date)} · {movement.direction === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}{movement.note ? ` · ${movement.note}` : ''}</span><CurrencyAmount amount={movement.amount} className="font-medium" /></li>)}</ul> : <p className="mt-3 text-xs text-[var(--secondary)]">No transfers recorded yet.</p>}
              </div>)}
              <div className="flex flex-wrap justify-between gap-2 rounded-b-2xl border-t border-[var(--border)] bg-[var(--muted)]/50 px-4 py-3 text-sm sm:px-5"><span className="font-medium">Projection summary</span><span className="text-right"><CurrencyAmount amount={goal.monthlyContribution} /> / month · <CurrencyAmount amount={goal.projectedGrowth} /> estimated growth</span></div>
            </div> : null}
          </Card>
        }) : <Card className="p-8 text-center text-sm text-[var(--secondary)]">No {activeStatus.toLowerCase()} savings goals.</Card>}
      </section>
      <PaginationControls page={goalsQuery.data.page} totalPages={goalsQuery.data.totalPages} total={goalsQuery.data.total} limit={goalsQuery.data.limit} onPageChange={setGoalPage} />
      </>}

      <Modal open={addForm.isOpen || !!editingGoal} onClose={closeGoalForm} title={editingGoal ? 'Edit savings goal' : 'Create savings goal'} className="sm:max-w-4xl">
        <form className="space-y-5" onSubmit={goalForm.handleSubmit(submitGoal)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium" htmlFor="goal-name">Goal name<Input id="goal-name" placeholder="Emergency fund" {...goalForm.register('name')} error={goalForm.formState.errors.name?.message} /></label><label className="space-y-2 text-sm font-medium" htmlFor="goal-target">Target amount (₹)<Input id="goal-target" type="number" min="0.01" step="0.01" {...goalForm.register('targetAmount', { valueAsNumber: true })} error={goalForm.formState.errors.targetAmount?.message} /></label><label className="space-y-2 text-sm font-medium" htmlFor="goal-date">Target date<Input id="goal-date" type="date" {...goalForm.register('targetDate')} error={goalForm.formState.errors.targetDate?.message} /></label><label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="goal-notes">Notes<textarea id="goal-notes" rows={2} className={`${fieldClass} h-auto py-2`} {...goalForm.register('notes')} /></label></div>
                    <div className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Savings allocations</h3><Button type="button" size="sm" variant="outline" onClick={() => allocationFields.append({ name: '', optionType: 'BANK_SAVINGS', expectedAnnualReturnRate: 0, compoundingFrequency: 'MONTHLY', monthlyContribution: 0 })}><Plus className="h-4 w-4" />Add allocation</Button></div>
                      {allocationFields.fields.map((field, index) => <div key={field.id} className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_1fr_1fr_auto] xl:items-end">
                        <input type="hidden" {...goalForm.register(`allocations.${index}.id`)} />
                        <label className="space-y-2 text-xs font-medium" htmlFor={`allocation-name-${index}`}>Allocation name<Input id={`allocation-name-${index}`} placeholder="Emergency savings" {...goalForm.register(`allocations.${index}.name`)} error={goalForm.formState.errors.allocations?.[index]?.name?.message} /></label>
                        <label className="space-y-2 text-xs font-medium" htmlFor={`allocation-type-${index}`}>Savings option<select id={`allocation-type-${index}`} className={fieldClass} {...goalForm.register(`allocations.${index}.optionType`)}>{optionTypes.map((option) => <option key={option} value={option}>{optionLabels[option]}</option>)}</select></label>
                        <label className="space-y-2 text-xs font-medium" htmlFor={`allocation-return-${index}`}>Return (% p.a.)<Input id={`allocation-return-${index}`} type="number" min="0" max="100" step="0.01" {...goalForm.register(`allocations.${index}.expectedAnnualReturnRate`, { valueAsNumber: true })} /></label>
                        <label className="space-y-2 text-xs font-medium" htmlFor={`allocation-compound-${index}`}>Compounds<select id={`allocation-compound-${index}`} className={fieldClass} {...goalForm.register(`allocations.${index}.compoundingFrequency`)}>{compoundingFrequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency.replaceAll('_', ' ').toLowerCase()}</option>)}</select></label>
                        <label className="space-y-2 text-xs font-medium" htmlFor={`allocation-monthly-${index}`}>Monthly save (₹)<Input id={`allocation-monthly-${index}`} type="number" min="0" step="0.01" {...goalForm.register(`allocations.${index}.monthlyContribution`, { valueAsNumber: true })} /></label>
                        <Button type="button" size="icon" variant="ghost" disabled={allocationFields.fields.length < 2} onClick={() => allocationFields.remove(index)} aria-label={`Remove allocation ${index + 1}`}><Trash2 className="h-4 w-4 text-[var(--danger)]" /></Button>
                      </div>)}
                    </div>
                    <p className="text-xs leading-5 text-[var(--secondary)]">No account is assigned to an allocation. Choose an account only when recording an actual deposit or withdrawal. Planned contributions and returns do not change account balances.</p>
                    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeGoalForm}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : editingGoal ? 'Save changes' : 'Create goal'}</Button></div>
                  </form>
                </Modal>

                <Modal open={Boolean(movementTarget)} onClose={() => { if (!movementMutation.isPending) setMovementTarget(null) }} title={movementTarget?.direction === 'DEPOSIT' ? 'Add savings' : 'Withdraw savings'} className="sm:max-w-xl">
                  {movementTarget ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={movementForm.handleSubmit(submitMovement)} noValidate>
                    <div className="sm:col-span-2"><p className="font-medium">{movementTarget.goal.name}</p><p className="mt-1 text-sm text-[var(--secondary)]">{movementTarget.allocationName}</p></div>
                    <label className="space-y-2 text-sm font-medium" htmlFor="movement-amount">Amount (₹)<Input id="movement-amount" type="number" min="0.01" step="0.01" autoFocus {...movementForm.register('amount', { valueAsNumber: true })} error={movementForm.formState.errors.amount?.message} /></label>
                    <label className="space-y-2 text-sm font-medium" htmlFor="movement-date">Date<Input id="movement-date" type="date" {...movementForm.register('transactionDate')} /></label>
                    <label className="space-y-2 text-sm font-medium" htmlFor="movement-account">{movementTarget.direction === 'DEPOSIT' ? 'From account' : 'To account'}<select id="movement-account" className={fieldClass} {...movementForm.register('counterpartAccountId')}><option value="">Select account</option>{availableCounterpartAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{movementForm.formState.errors.counterpartAccountId?.message ? <span className="text-xs text-[var(--danger)]">{movementForm.formState.errors.counterpartAccountId.message}</span> : null}</label>
                    <label className="space-y-2 text-sm font-medium" htmlFor="movement-mode">Payment mode<select id="movement-mode" className={fieldClass} {...movementForm.register('paymentMode')}>{paymentModes.map((payment) => <option key={payment} value={payment}>{payment.replaceAll('_', ' ')}</option>)}</select></label>
                    <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="movement-note">Note (optional)<Input id="movement-note" {...movementForm.register('note')} /></label>
                    <div className="rounded-lg bg-[var(--muted)] p-3 text-xs leading-5 text-[var(--secondary)] sm:col-span-2">This records an actual savings movement. Deposits reduce the selected account balance; withdrawals increase the selected destination balance. It is not counted as income or expense.</div>
                    <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setMovementTarget(null)}>Cancel</Button><Button type="submit" disabled={movementMutation.isPending}>{movementMutation.isPending ? 'Recording…' : movementTarget.direction === 'DEPOSIT' ? 'Record deposit' : 'Record withdrawal'}</Button></div>
                  </form> : null}
                </Modal>

                {goalToDelete ? <Modal open onClose={() => { if (!deleteMutation.isPending) setGoalToDelete(null) }} title="Delete savings goal?" className="sm:max-w-md">
                  <p className="text-sm leading-6 text-[var(--secondary)]">Delete <span className="font-semibold text-[var(--foreground)]">{goalToDelete.name}</span>? Goals with linked account transfers can’t be deleted because those movements are part of your ledger.</p>
                  <div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={deleteMutation.isPending} onClick={() => setGoalToDelete(null)}>Keep goal</Button><Button variant="danger" disabled={deleteMutation.isPending || hasTransferHistory(goalToDelete)} onClick={() => deleteMutation.mutate(goalToDelete)}>{deleteMutation.isPending ? 'Deleting…' : 'Delete goal'}</Button></div>
                </Modal> : null}
              </div>
            )
          }