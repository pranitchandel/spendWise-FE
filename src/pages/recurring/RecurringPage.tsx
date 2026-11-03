import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, Clock3, Pencil, Plus, RotateCcw, SkipForward, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { accountsApi } from '@/api/accounts'
import { getErrorMessage } from '@/api/client'
import { categoriesApi } from '@/api/categories'
import { recurringApi, type RecurringInput } from '@/api/recurring'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { todayISO, formatDate } from '@/lib/date'
import type { PaymentMode, RecurringFrequency, RecurringRule, TransactionType } from '@/types'
import { useMobileAddForm } from '@/hooks/useMobileAddForm'
import { useToast } from '@/contexts/ToastContext'

const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'] as const
const modes = ['UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'NET_BANKING', 'OTHER'] as const
const types = ['EXPENSE', 'INCOME', 'TRANSFER'] as const
const schema = z.object({
  name: z.string().trim().min(1, 'Enter a schedule name'),
  type: z.enum(types),
  amount: z.number().positive('Amount must be greater than zero'),
  frequency: z.enum(frequencies),
  categoryId: z.string().min(1, 'Choose a category'),
  accountId: z.string().min(1, 'Choose an account'),
  toAccountId: z.string().optional(),
  paymentMode: z.enum(modes),
  description: z.string().optional(),
  notes: z.string().max(2000).optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
})
type RuleForm = z.infer<typeof schema>
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const fieldClass = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'

export function RecurringPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const addForm = useMobileAddForm()
  const [postponeDates, setPostponeDates] = useState<Record<string, string>>({})
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null)
  const [ruleToDelete, setRuleToDelete] = useState<RecurringRule | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const rulesQuery = useQuery({ queryKey: ['recurring'], queryFn: recurringApi.list })
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list() })
  const form = useForm<RuleForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: 'EXPENSE', amount: undefined, frequency: 'MONTHLY', categoryId: '', accountId: '', toAccountId: '', paymentMode: 'UPI', description: '', notes: '', startDate: todayISO(), endDate: '' },
  })
  const selectedType = form.watch('type')
  const availableCategories = categoriesQuery.data?.filter((category) => category.type === selectedType || (selectedType === 'TRANSFER' && category.type === 'TRANSFER')) ?? []

  const refresh = async () => queryClient.invalidateQueries({ queryKey: ['recurring'] })
  const saveMutation = useMutation({
    mutationFn: (input: RecurringInput) => editingRule
      ? recurringApi.update(editingRule.id, input)
      : recurringApi.create(input),
    onSuccess: async () => {
      const wasEditing = Boolean(editingRule)
      form.reset({ name: '', type: 'EXPENSE', amount: undefined, frequency: 'MONTHLY', categoryId: '', accountId: '', toAccountId: '', paymentMode: 'UPI', description: '', notes: '', startDate: todayISO(), endDate: '' })
      await refresh()
      addForm.close()
      setEditingRule(null)
      showToast(wasEditing ? 'Recurring schedule updated.' : 'Recurring schedule created.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => recurringApi.delete(id),
    onSuccess: async () => {
      await refresh()
      setRuleToDelete(null)
      showToast('Schedule deleted. Existing history was kept.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const restoreMutation = useMutation({
    mutationFn: (id: string) => recurringApi.update(id, { isActive: true }),
    onSuccess: async () => {
      await refresh()
      showToast('Recurring schedule restored.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const generateMutation = useMutation({
    mutationFn: () => recurringApi.generate(todayISO()),
    onSuccess: async () => { await refresh(); showToast('Due entries checked.', 'success') },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const actionMutation = useMutation({
    mutationFn: ({ ruleId, occurrenceId, action, postponedTo, accountId, paymentMode }: { ruleId: string; occurrenceId: string; action: 'PAID' | 'SKIPPED' | 'POSTPONED'; postponedTo?: string; accountId?: string; paymentMode?: PaymentMode }) => recurringApi.updateOccurrence(ruleId, occurrenceId, { action, postponedTo, accountId, paymentMode }),
    onSuccess: async () => { await refresh(); showToast('Recurring entry updated.', 'success') },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  if (rulesQuery.isLoading || accountsQuery.isLoading || categoriesQuery.isLoading) return <LoadingState label="Loading schedules…" />
  if (rulesQuery.isError || accountsQuery.isError || categoriesQuery.isError || !rulesQuery.data || !accountsQuery.data || !categoriesQuery.data) return <div role="alert" className="text-sm text-[var(--danger)]">Recurring schedules couldn’t be loaded.</div>

  function submit(values: RuleForm) {
    const input: RecurringInput = {
      ...values,
      type: values.type as TransactionType,
      frequency: values.frequency as RecurringFrequency,
      paymentMode: values.paymentMode as PaymentMode,
      toAccountId: values.type === 'TRANSFER' ? values.toAccountId : undefined,
      notes: values.notes?.trim() || undefined,
      endDate: values.endDate || null,
    }
    saveMutation.mutate(input)
  }

  function openAddForm() {
    setEditingRule(null)
    form.reset({ name: '', type: 'EXPENSE', amount: undefined, frequency: 'MONTHLY', categoryId: '', accountId: '', toAccountId: '', paymentMode: 'UPI', description: '', notes: '', startDate: todayISO(), endDate: '' })
  }

  function editRule(rule: RecurringRule) {
    addForm.close()
    setEditingRule(rule)
    form.reset({
      name: rule.name,
      type: rule.type as typeof types[number],
      amount: rule.amount,
      frequency: rule.frequency,
      categoryId: rule.categoryId,
      accountId: rule.accountId,
      toAccountId: rule.toAccountId ?? '',
      paymentMode: rule.paymentMode,
      description: rule.description,
      notes: rule.notes ?? '',
      startDate: rule.startDate,
      endDate: rule.endDate ?? '',
    })
  }

  function closeForm() {
    addForm.close()
    setEditingRule(null)
    form.reset({ name: '', type: 'EXPENSE', amount: undefined, frequency: 'MONTHLY', categoryId: '', accountId: '', toAccountId: '', paymentMode: 'UPI', description: '', notes: '', startDate: todayISO(), endDate: '' })
  }

  const visibleRules = rulesQuery.data.filter((rule) => showInactive || rule.isActive)
  const pendingCount = rulesQuery.data.filter((rule) => rule.isActive).reduce((total, rule) => total + (rule.occurrences?.filter((item) => item.status === 'PENDING').length ?? 0), 0)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--primary)]">Scheduled, never auto-paid</p><h2 className="mt-1 text-2xl font-semibold">Recurring payments</h2></div>
        <div className="flex flex-wrap gap-2">
          <Link to="/recurring?add=1" onClick={openAddForm}><Button><Plus className="h-4 w-4" />Add schedule</Button></Link>
          <Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}><CalendarClock className="h-4 w-4" />{generateMutation.isPending ? 'Checking due dates…' : `Generate due entries${pendingCount ? ` (${pendingCount} pending)` : ''}`}</Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--secondary)]">
        <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Show inactive schedules
      </label>

      <Modal open={addForm.isOpen || !!editingRule} onClose={closeForm} title={editingRule ? 'Edit recurring schedule' : 'Add a schedule'} className="sm:max-w-3xl">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={form.handleSubmit(submit)} noValidate>
          <label htmlFor="rule-name" className="space-y-2 text-sm font-medium">Name<Input id="rule-name" {...form.register('name')} error={form.formState.errors.name?.message} /></label>
          <label htmlFor="rule-type" className="space-y-2 text-sm font-medium">Type<select id="rule-type" className={fieldClass} {...form.register('type', { onChange: () => form.setValue('categoryId', '') })}>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label htmlFor="rule-amount" className="space-y-2 text-sm font-medium">Amount (₹)<Input id="rule-amount" type="number" min="0.01" step="0.01" {...form.register('amount', { valueAsNumber: true })} error={form.formState.errors.amount?.message} /></label>
          <label htmlFor="rule-frequency" className="space-y-2 text-sm font-medium">Frequency<select id="rule-frequency" className={fieldClass} {...form.register('frequency')}>{frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency.replaceAll('_', ' ')}</option>)}</select></label>
          <label htmlFor="rule-category" className="space-y-2 text-sm font-medium">Category<select id="rule-category" className={fieldClass} {...form.register('categoryId')}><option value="">Select category</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label htmlFor="rule-account" className="space-y-2 text-sm font-medium">Account<select id="rule-account" className={fieldClass} {...form.register('accountId')}><option value="">Select account</option>{accountsQuery.data.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          {selectedType === 'TRANSFER' ? <label htmlFor="rule-destination" className="space-y-2 text-sm font-medium">Destination<select id="rule-destination" className={fieldClass} {...form.register('toAccountId')}><option value="">Select destination</option>{accountsQuery.data.filter((account) => !account.isArchived && account.id !== form.watch('accountId')).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label> : null}
          <label htmlFor="rule-mode" className="space-y-2 text-sm font-medium">Payment mode<select id="rule-mode" className={fieldClass} {...form.register('paymentMode')}>{modes.map((mode) => <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>)}</select></label>
          <label htmlFor="rule-start" className="space-y-2 text-sm font-medium">Start date<Input id="rule-start" type="date" {...form.register('startDate')} /></label>
          <label htmlFor="rule-end" className="space-y-2 text-sm font-medium">End date (optional)<Input id="rule-end" type="date" {...form.register('endDate')} /></label>
          <label htmlFor="rule-description" className="space-y-2 text-sm font-medium">Description<Input id="rule-description" {...form.register('description')} /></label>
          <label htmlFor="rule-notes" className="space-y-2 text-sm font-medium">Notes<textarea id="rule-notes" rows={2} className={`${fieldClass} h-auto py-2`} {...form.register('notes')} /></label>
          <div className="flex items-end gap-2"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : editingRule ? 'Save changes' : 'Save schedule'}</Button></div>
        </form>
      </Modal>

      {ruleToDelete ? (
        <Modal open onClose={() => { if (!deleteMutation.isPending) setRuleToDelete(null) }} title="Delete recurring schedule?" className="sm:max-w-md">
          <p className="text-sm leading-6 text-[var(--secondary)]">
            This stops future entries for <span className="font-semibold text-[var(--foreground)]">{ruleToDelete.name}</span>. Existing occurrences and transactions are kept. You can restore the schedule from inactive schedules.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => setRuleToDelete(null)}>Cancel</Button>
            <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(ruleToDelete.id)}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete schedule'}
            </Button>
          </div>
        </Modal>
      ) : null}

      <section className="space-y-3" aria-label="Recurring schedules">
        {visibleRules.length ? visibleRules.map((rule) => {
          const category = categoriesQuery.data.find((item) => item.id === rule.categoryId)?.name ?? 'Category'
          const account = accountsQuery.data.find((item) => item.id === rule.accountId)?.name ?? 'Account'
          return <Card key={rule.id} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]"><Clock3 className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate font-semibold">{rule.name}</p><p className="mt-1 truncate text-xs text-[var(--secondary)]">{rule.frequency.replaceAll('_', ' ').toLowerCase()} · {category} · {account}</p></div></div>
              <div className="flex flex-wrap items-center justify-end gap-4">
                <div className="text-right"><p className="font-semibold tabular-nums">{currency.format(rule.amount)}</p><p className="mt-1 text-xs text-[var(--secondary)]">{rule.isActive ? `Next: ${formatDate(rule.nextDueDate)}` : 'Inactive'}</p></div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => editRule(rule)} aria-label={`Edit ${rule.name}`}><Pencil className="h-4 w-4" />Edit</Button>
                  {rule.isActive ? (
                    <Button size="sm" variant="ghost" onClick={() => setRuleToDelete(rule)} disabled={deleteMutation.isPending} aria-label={`Delete ${rule.name}`}><Trash2 className="h-4 w-4 text-[var(--danger)]" />Delete</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => restoreMutation.mutate(rule.id)} disabled={restoreMutation.isPending}><RotateCcw className="h-4 w-4" />Restore</Button>
                  )}
                </div>
              </div>
            </div>
            {rule.occurrences?.length ? <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
              {rule.occurrences.map((occurrence) => <li key={occurrence.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div><p className="text-sm font-medium">{formatDate(occurrence.dueDate)} · {currency.format(occurrence.amount)}</p><p className="mt-0.5 text-xs text-[var(--secondary)]">{occurrence.status.toLowerCase()}{occurrence.postponedTo ? ` · moved to ${formatDate(occurrence.postponedTo)}` : ''}</p></div>
                {occurrence.status === 'PENDING' ? <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="success" onClick={() => actionMutation.mutate({ ruleId: rule.id, occurrenceId: occurrence.id, action: 'PAID', accountId: rule.accountId, paymentMode: rule.paymentMode })} disabled={actionMutation.isPending}><Check className="h-4 w-4" />Paid</Button>
                  <Button size="sm" variant="outline" onClick={() => actionMutation.mutate({ ruleId: rule.id, occurrenceId: occurrence.id, action: 'SKIPPED' })} disabled={actionMutation.isPending}><SkipForward className="h-4 w-4" />Skip</Button>
                  <input aria-label={`Postpone date for ${rule.name}`} type="date" min={todayISO()} value={postponeDates[occurrence.id] ?? ''} onChange={(event) => setPostponeDates((current) => ({ ...current, [occurrence.id]: event.target.value }))} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--foreground)]" />
                  <Button size="sm" variant="outline" disabled={!postponeDates[occurrence.id] || actionMutation.isPending} onClick={() => actionMutation.mutate({ ruleId: rule.id, occurrenceId: occurrence.id, action: 'POSTPONED', postponedTo: postponeDates[occurrence.id] })}>Postpone</Button>
                </div> : null}
              </li>)}
            </ul> : <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--secondary)]">No due entries generated.</p>}
          </Card>
        }) : <Card className="p-8 text-center text-sm text-[var(--secondary)]">{showInactive ? 'No recurring schedules found.' : 'No active schedules. Enable “Show inactive schedules” to review canceled schedules.'}</Card>}
      </section>
    </div>
  )
}