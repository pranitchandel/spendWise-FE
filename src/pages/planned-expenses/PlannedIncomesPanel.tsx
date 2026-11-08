import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, CircleDollarSign, EllipsisVertical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { accountsApi } from '@/api/accounts'
import { categoriesApi } from '@/api/categories'
import { getErrorMessage } from '@/api/client'
import { plannedIncomesApi, type PlannedIncomeInput } from '@/api/plannedIncomes'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CurrencyAmount } from '@/components/ui/CurrencyAmount'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { useToast } from '@/contexts/ToastContext'
import { formatDate, todayISO } from '@/lib/date'
import { incomeOccurrenceDates, incomeScheduleDates } from '@/lib/planned-cashflow'
import type { PaymentMode, PlannedIncome, PlannedIncomeStatus } from '@/types'

const paymentModes = ['UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'NET_BANKING', 'OTHER'] as const
const planSchema = z.object({
  name: z.string().trim().min(1, 'Enter an income name'),
  amount: z.number().positive('Amount must be greater than zero'),
  accountId: z.string().min(1, 'Choose the receiving account'),
  startDate: z.string().min(1, 'Choose the first date'),
  frequency: z.enum(['ONCE', 'MONTHLY']),
  endDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
})
const actualSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  actualDate: z.string().min(1),
  paymentMode: z.enum(paymentModes),
  categoryId: z.string().min(1, 'Choose an income category'),
  note: z.string().max(2000).optional(),
})
type PlanForm = z.infer<typeof planSchema>
type ActualForm = z.infer<typeof actualSchema>
type RecordTarget = { plan: PlannedIncome; scheduledDate: string }
const fieldClass = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'
const statusTabs: Array<{ value: PlannedIncomeStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function PlannedIncomesPanel() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editing, setEditing] = useState<PlannedIncome | null>(null)
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null)
  const [activeStatus, setActiveStatus] = useState<PlannedIncomeStatus>('ACTIVE')
  const [page, setPage] = useState(1)
  const [planActionsId, setPlanActionsId] = useState<string | null>(null)
  const plansQuery = useQuery({
    queryKey: ['planned-incomes', activeStatus, page],
    queryFn: () => plannedIncomesApi.listPage({ status: activeStatus, page, limit: 20 }),
    placeholderData: (previous) => previous,
  })
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const categoriesQuery = useQuery({ queryKey: ['categories', 'income'], queryFn: () => categoriesApi.list({ type: 'INCOME' }) })
  const planForm = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
    defaultValues: { name: '', amount: 0, accountId: '', startDate: todayISO(), frequency: 'MONTHLY', endDate: '', notes: '' },
  })
  const actualForm = useForm<ActualForm>({
    resolver: zodResolver(actualSchema),
    defaultValues: { amount: 0, actualDate: todayISO(), paymentMode: 'BANK_TRANSFER', categoryId: '', note: '' },
  })
  useEffect(() => {
    if (searchParams.get('addIncome') !== '1') return
    openPlanForm()
    const next = new URLSearchParams(searchParams)
    next.delete('addIncome')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['planned-incomes'] }),
    queryClient.invalidateQueries({ queryKey: ['planned-expenses'] }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['accounts'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ])
  const saveMutation = useMutation({
    mutationFn: (input: PlannedIncomeInput) => editing ? plannedIncomesApi.update(editing.id, input) : plannedIncomesApi.create(input),
    onSuccess: async () => {
      await refresh()
      closePlanForm()
      showToast(editing ? 'Income plan updated.' : 'Income plan created.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const statusMutation = useMutation({
    mutationFn: ({ plan, status }: { plan: PlannedIncome; status: PlannedIncomeStatus }) => plannedIncomesApi.update(plan.id, { status }),
    onSuccess: async () => { await refresh(); showToast('Income plan status updated.', 'success') },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => plannedIncomesApi.remove(id),
    onSuccess: async () => { await refresh(); showToast('Income plan deleted.', 'success') },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const actualMutation = useMutation({
    mutationFn: ({ target, values }: { target: RecordTarget; values: ActualForm }) => {
      const categoryId = categoriesQuery.data?.find((category) => category.id === values.categoryId)?.id
      if (!categoryId) throw new Error('Income category is unavailable')
      return plannedIncomesApi.recordActual(target.plan.id, {
        scheduledDate: target.scheduledDate,
        actualDate: values.actualDate,
        amount: values.amount,
        paymentMode: values.paymentMode as PaymentMode,
        categoryId,
        note: values.note?.trim() || undefined,
      })
    },
    onSuccess: async () => {
      await refresh()
      setRecordTarget(null)
      showToast('Actual income recorded in transactions.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  function closePlanForm() {
    setPlanFormOpen(false)
    setEditing(null)
    planForm.reset({ name: '', amount: 0, accountId: '', startDate: todayISO(), frequency: 'MONTHLY', endDate: '', notes: '' })
  }

  function openPlanForm(plan?: PlannedIncome) {
    setPlanFormOpen(true)
    setEditing(plan ?? null)
    planForm.reset(plan ? {
      name: plan.name, amount: plan.amount, accountId: plan.accountId, startDate: plan.startDate,
      frequency: plan.frequency, endDate: plan.endDate ?? '', notes: plan.notes,
    } : { name: '', amount: 0, accountId: '', startDate: todayISO(), frequency: 'MONTHLY', endDate: '', notes: '' })
  }

  function openRecord(plan: PlannedIncome, scheduledDate: string) {
    actualForm.reset({ amount: plan.amount, actualDate: todayISO(), paymentMode: 'BANK_TRANSFER', categoryId: categoriesQuery.data?.[0]?.id ?? '', note: '' })
    setRecordTarget({ plan, scheduledDate })
  }

  if (plansQuery.isLoading || accountsQuery.isLoading || categoriesQuery.isLoading) return <LoadingState label="Loading income plans…" />
  if (plansQuery.isError || accountsQuery.isError || categoriesQuery.isError || !plansQuery.data || !accountsQuery.data || !categoriesQuery.data) {
    return <div role="alert" className="text-sm text-[var(--danger)]">Income plans couldn’t be loaded.</div>
  }

  const activeAccounts = accountsQuery.data.filter((account) => account.isActive && !account.isArchived)
  const plans = plansQuery.data.items
  const nextDates = (plan: PlannedIncome) => incomeOccurrenceDates(plan, todayISO(), '9999-12-31').slice(0, 3)
  const activePlans = plans
  const plannedToDate = activePlans.reduce((total, plan) => total + incomeScheduleDates(plan, todayISO()).filter((date) => date <= todayISO()).length * plan.amount, 0)
  const actualToDate = activePlans.reduce((total, plan) => total + plan.actuals.filter((actual) => actual.scheduledDate <= todayISO()).reduce((sum, actual) => sum + actual.amount, 0), 0)
  const varianceToDate = actualToDate - plannedToDate

  function submitPlan(values: PlanForm) {
    saveMutation.mutate({ ...values, endDate: values.frequency === 'MONTHLY' && values.endDate ? values.endDate : null, notes: values.notes?.trim() || '' })
  }

  return <section className="space-y-4" aria-label="Planned income schedules">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="text-lg font-semibold">Planned income</h3><p className="mt-1 text-sm text-[var(--secondary)]">Schedule salary and other inflows. Forecasts stay separate from account balances until you record the actual income.</p></div>
      <Button className="hidden lg:inline-flex" onClick={() => openPlanForm()}><Plus className="h-4 w-4" />Add income plan</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Scheduled through today</p><p className="mt-2 text-xl font-semibold"><CurrencyAmount amount={plannedToDate} /></p></Card>
      <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Actual received</p><p className="mt-2 text-xl font-semibold"><CurrencyAmount amount={actualToDate} /></p></Card>
      <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Actual vs plan</p><p className={`mt-2 text-xl font-semibold ${varianceToDate < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>{varianceToDate >= 0 ? '+' : '−'}<CurrencyAmount amount={Math.abs(varianceToDate)} /></p></Card>
    </div>
    <div className="flex w-full gap-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1 sm:inline-flex sm:w-auto" role="tablist" aria-label="Income plan status">
      {statusTabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeStatus === tab.value} onClick={() => { setActiveStatus(tab.value); setPage(1) }} className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeStatus === tab.value ? 'bg-[var(--primary)] text-white shadow-sm' : 'bg-[var(--card)]/60 text-[var(--secondary)] hover:text-[var(--foreground)]'}`}>{tab.label}</button>)}
    </div>
    <div className="space-y-3">
      {plans.length ? plans.map((plan) => <Card key={plan.id} className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:flex-wrap">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]"><CircleDollarSign className="h-5 w-5" /></div>
            <div className="min-w-0"><h4 className="break-words font-semibold">{plan.name}</h4><p className="mt-1 text-xs text-[var(--secondary)]">{plan.frequency === 'MONTHLY' ? 'Monthly' : 'One-time'} · {plan.accountName} · from {formatDate(plan.startDate)}{plan.endDate ? ` to ${formatDate(plan.endDate)}` : ''}</p>{plan.notes ? <p className="mt-2 text-sm text-[var(--secondary)]">{plan.notes}</p> : null}</div>
          </div>
          <div className="relative ml-auto shrink-0 sm:hidden">
            <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Actions for ${plan.name}`} aria-expanded={planActionsId === plan.id} aria-haspopup="menu" onClick={() => setPlanActionsId((current) => current === plan.id ? null : plan.id)}><EllipsisVertical className="h-5 w-5" /></Button>
            {planActionsId === plan.id ? <div role="menu" className="absolute right-0 top-full z-50 mt-1 flex w-52 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
              {plan.status === 'ACTIVE' ? <>
                <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" onClick={() => { setPlanActionsId(null); openPlanForm(plan) }}><Pencil className="h-4 w-4" />Edit plan</Button>
                <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={statusMutation.isPending} onClick={() => { setPlanActionsId(null); statusMutation.mutate({ plan, status: 'COMPLETED' }) }}><CheckCircle2 className="h-4 w-4 text-[var(--success)]" />Mark completed</Button>
                <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={statusMutation.isPending} onClick={() => { setPlanActionsId(null); statusMutation.mutate({ plan, status: 'CANCELLED' }) }}><Ban className="h-4 w-4 text-[var(--danger)]" />Cancel plan</Button>
                {plan.actuals.length === 0 ? <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3 text-[var(--danger)]" disabled={deleteMutation.isPending} onClick={() => { setPlanActionsId(null); deleteMutation.mutate(plan.id) }}><Trash2 className="h-4 w-4" />Delete plan</Button> : null}
              </> : <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={statusMutation.isPending} onClick={() => { setPlanActionsId(null); statusMutation.mutate({ plan, status: 'ACTIVE' }) }}><RotateCcw className="h-4 w-4" />Reopen plan</Button>}
            </div> : null}
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            {plan.status === 'ACTIVE' ? <>
              <Button size="icon" variant="ghost" aria-label={`Edit ${plan.name}`} onClick={() => openPlanForm(plan)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ plan, status: 'COMPLETED' })}><CheckCircle2 className="h-4 w-4" />Complete</Button>
              <Button size="icon" variant="ghost" aria-label={`Cancel ${plan.name}`} title="Cancel plan" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ plan, status: 'CANCELLED' })}><Ban className="h-4 w-4 text-[var(--danger)]" /></Button>
            </> : <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ plan, status: 'ACTIVE' })}><RotateCcw className="h-4 w-4" />Reopen</Button>}
            {plan.actuals.length === 0 && plan.status === 'ACTIVE' ? <Button size="icon" variant="ghost" aria-label={`Delete ${plan.name}`} disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(plan.id)}><Trash2 className="h-4 w-4 text-[var(--danger)]" /></Button> : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-3">
          <div><p className="text-xs text-[var(--secondary)]">Planned amount</p><p className="mt-1 font-semibold"><CurrencyAmount amount={plan.amount} />{plan.frequency === 'MONTHLY' ? ' / month' : ''}</p></div>
          <div><p className="text-xs text-[var(--secondary)]">Actual occurrences</p><p className="mt-1 font-semibold">{plan.actuals.length}</p></div>
          <div><p className="text-xs text-[var(--secondary)]">Next planned dates</p><p className="mt-1 text-sm">{nextDates(plan).map((date) => formatDate(date)).join(' · ') || 'No future occurrences'}</p></div>
        </div>
        {plan.status === 'ACTIVE' && nextDates(plan).length ? <div className="mt-3 flex flex-wrap gap-2">{nextDates(plan).map((date) => <Button key={date} size="sm" variant="outline" onClick={() => openRecord(plan, date)} disabled={plan.actuals.some((actual) => actual.scheduledDate === date)}>Record {formatDate(date)}</Button>)}</div> : null}
        {plan.actuals.length ? <ul className="mt-3 divide-y divide-[var(--border)] border-l-2 border-[var(--border)] pl-3">{plan.actuals.map((actual) => <li key={actual.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span className="text-[var(--secondary)]">Scheduled {formatDate(actual.scheduledDate)} · received {formatDate(actual.actualDate)}</span><span className="font-medium"><CurrencyAmount amount={actual.amount} /></span></li>)}</ul> : null}
      </Card>) : <Card className="p-8 text-center text-sm text-[var(--secondary)]">No {activeStatus.toLowerCase()} income plans.</Card>}
    </div>
    <PaginationControls page={plansQuery.data.page} totalPages={plansQuery.data.totalPages} total={plansQuery.data.total} limit={plansQuery.data.limit} onPageChange={setPage} />

    <Modal open={planFormOpen} onClose={closePlanForm} title={editing ? 'Edit income plan' : 'Add planned income'} className="sm:max-w-2xl">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={planForm.handleSubmit(submitPlan)} noValidate>
        <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="income-name">Income name<Input id="income-name" placeholder="Salary" {...planForm.register('name')} error={planForm.formState.errors.name?.message} /></label>
        <label className="space-y-2 text-sm font-medium" htmlFor="income-amount">Expected amount (₹)<Input id="income-amount" type="number" min="0.01" step="0.01" {...planForm.register('amount', { valueAsNumber: true })} error={planForm.formState.errors.amount?.message} /></label>
        <label className="space-y-2 text-sm font-medium" htmlFor="income-account">Receive into<select id="income-account" className={fieldClass} {...planForm.register('accountId')}><option value="">Select account</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{planForm.formState.errors.accountId?.message ? <span className="text-xs text-[var(--danger)]">{planForm.formState.errors.accountId.message}</span> : null}</label>
        <label className="space-y-2 text-sm font-medium" htmlFor="income-start-date">First expected date<Input id="income-start-date" type="date" {...planForm.register('startDate')} /></label>
        <label className="space-y-2 text-sm font-medium" htmlFor="income-frequency">Frequency<select id="income-frequency" className={fieldClass} {...planForm.register('frequency')}><option value="MONTHLY">Monthly</option><option value="ONCE">One time</option></select></label>
        {planForm.watch('frequency') === 'MONTHLY' ? <label className="space-y-2 text-sm font-medium" htmlFor="income-end-date">End date (optional)<Input id="income-end-date" type="date" {...planForm.register('endDate')} /></label> : null}
        <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="income-notes">Notes (optional)<textarea id="income-notes" rows={2} className={`${fieldClass} h-auto py-2`} {...planForm.register('notes')} /></label>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={closePlanForm}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create plan'}</Button></div>
      </form>
    </Modal>

    <Modal open={!!recordTarget} onClose={() => { if (!actualMutation.isPending) setRecordTarget(null) }} title="Record actual income" className="sm:max-w-xl">
      {recordTarget ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={actualForm.handleSubmit((values) => actualMutation.mutate({ target: recordTarget, values }))} noValidate>
        <div className="sm:col-span-2"><p className="font-medium">{recordTarget.plan.name}</p><p className="mt-1 text-sm text-[var(--secondary)]">Scheduled {formatDate(recordTarget.scheduledDate)} · {recordTarget.plan.accountName}</p></div>
        <label className="space-y-2 text-sm font-medium" htmlFor="income-actual-amount">Actual amount (₹)<Input id="income-actual-amount" type="number" min="0.01" step="0.01" {...actualForm.register('amount', { valueAsNumber: true })} error={actualForm.formState.errors.amount?.message} /></label>
        <label className="space-y-2 text-sm font-medium" htmlFor="income-actual-date">Received date<Input id="income-actual-date" type="date" {...actualForm.register('actualDate')} /></label>
        <label className="space-y-2 text-sm font-medium" htmlFor="income-actual-category">Income category<select id="income-actual-category" className={fieldClass} {...actualForm.register('categoryId')}><option value="">Select category</option>{categoriesQuery.data.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{actualForm.formState.errors.categoryId?.message ? <span className="text-xs text-[var(--danger)]">{actualForm.formState.errors.categoryId.message}</span> : null}</label>
        <label className="space-y-2 text-sm font-medium" htmlFor="income-actual-mode">Payment mode<select id="income-actual-mode" className={fieldClass} {...actualForm.register('paymentMode')}>{paymentModes.map((mode) => <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="income-actual-note">Note (optional)<Input id="income-actual-note" {...actualForm.register('note')} /></label>
        <div className="rounded-lg bg-[var(--muted)] p-3 text-xs leading-5 text-[var(--secondary)] sm:col-span-2">Recording creates an actual income transaction and updates the receiving account balance. The forecast will stop counting this scheduled occurrence as pending.</div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setRecordTarget(null)}>Cancel</Button><Button type="submit" disabled={actualMutation.isPending}>{actualMutation.isPending ? 'Recording…' : 'Record income'}</Button></div>
      </form> : null}
    </Modal>
  </section>
}