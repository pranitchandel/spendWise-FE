import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock3, EllipsisVertical, Pencil, Plus, ReceiptText, RotateCcw, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { accountsApi } from '@/api/accounts'
import { categoriesApi } from '@/api/categories'
import { getErrorMessage } from '@/api/client'
import { plannedExpensesApi, type PlannedExpenseInput } from '@/api/plannedExpenses'
import { transactionsApi } from '@/api/transactions'
import { useToast } from '@/contexts/ToastContext'
import { useMobileAddForm } from '@/hooks/useMobileAddForm'
import { formatDate, todayISO } from '@/lib/date'
import { formatINR } from '@/lib/money'
import type { PaymentMode, PlannedExpense, PlannedExpenseStatus } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'

const paymentModes = ['UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'NET_BANKING', 'OTHER'] as const
const campaignSchema = z.object({
  name: z.string().trim().min(1, 'Enter a campaign name'),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1, 'Name this estimate line'),
    categoryId: z.string().min(1, 'Choose a category'),
    estimatedAmount: z.number().positive('Estimate must be greater than zero'),
  })).min(1, 'Add at least one estimate line'),
})
const spendSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  transactionDate: z.string().min(1),
  accountId: z.string().min(1, 'Choose an account'),
  paymentMode: z.enum(paymentModes),
  categoryId: z.string().optional(),
  note: z.string().max(2000).optional(),
})
type CampaignForm = z.infer<typeof campaignSchema>
type SpendForm = z.infer<typeof spendSchema>
type SpendTarget = {
  campaign: PlannedExpense
  itemId: string
  itemName: string
  categoryId: string | null
  transaction?: PlannedExpense['items'][number]['transactions'][number]
}
const fieldClass = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'

const statusTabs: Array<{ value: PlannedExpenseStatus; label: string }> = [
  { value: 'PLANNED', label: 'Upcoming' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function PlannedExpensesPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const addForm = useMobileAddForm()
  const [editingCampaign, setEditingCampaign] = useState<PlannedExpense | null>(null)
  const [campaignToDelete, setCampaignToDelete] = useState<PlannedExpense | null>(null)
  const [spendTarget, setSpendTarget] = useState<SpendTarget | null>(null)
  const [spendToDelete, setSpendToDelete] = useState<SpendTarget | null>(null)
  const [spendActionsId, setSpendActionsId] = useState<string | null>(null)
  const [campaignActionsId, setCampaignActionsId] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<PlannedExpenseStatus>('PLANNED')
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const campaignsQuery = useQuery({ queryKey: ['planned-expenses'], queryFn: plannedExpensesApi.list })
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'expense'],
    queryFn: () => categoriesApi.list({ type: 'EXPENSE' }),
  })
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const campaignForm = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '', dueDate: '', notes: '',
      items: [{ name: '', categoryId: '', estimatedAmount: undefined }],
    },
  })
  const itemFields = useFieldArray({ control: campaignForm.control, name: 'items' })
  const spendForm = useForm<SpendForm>({
    resolver: zodResolver(spendSchema),
    defaultValues: { amount: undefined, transactionDate: todayISO(), accountId: '', paymentMode: 'UPI', note: '' },
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['planned-expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['statistics'] }),
    ])
  }
  const saveMutation = useMutation({
    mutationFn: (input: PlannedExpenseInput) => editingCampaign
      ? plannedExpensesApi.update(editingCampaign.id, input)
      : plannedExpensesApi.create(input),
    onSuccess: async () => {
      const wasEditing = Boolean(editingCampaign)
      await refresh()
      closeCampaignForm()
      showToast(wasEditing ? 'Campaign updated.' : 'Campaign created.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => plannedExpensesApi.remove(id),
    onSuccess: async () => {
      await refresh()
      setCampaignToDelete(null)
      showToast('Campaign deleted.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const campaignStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PlannedExpenseStatus }) =>
      plannedExpensesApi.update(id, { status }),
    onSuccess: async (_campaign, variables) => {
      await refresh()
      setCampaignActionsId(null)
      const message = variables.status === 'COMPLETED'
        ? 'Campaign marked completed.'
        : variables.status === 'CANCELLED'
          ? 'Campaign cancelled.'
          : 'Campaign reopened.'
      showToast(message, 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const spendMutation = useMutation({
    mutationFn: async ({ target, values }: { target: SpendTarget; values: SpendForm }) => {
      if (target.transaction) {
        await transactionsApi.update(target.transaction.id, {
          amount: values.amount,
          transactionDate: values.transactionDate,
          accountId: values.accountId,
          paymentMode: values.paymentMode as PaymentMode,
          note: values.note?.trim() || '',
        })
        return
      }
      await plannedExpensesApi.spend(
        target.campaign.id,
        {
          itemId: target.itemId,
          amount: values.amount,
          transactionDate: values.transactionDate,
          accountId: values.accountId,
          paymentMode: values.paymentMode as PaymentMode,
          note: values.note?.trim() || undefined,
          ...(target.itemId === 'legacy' ? { categoryId: target.categoryId || values.categoryId } : {}),
        },
        crypto.randomUUID(),
      )
    },
    onSuccess: async (_data, variables) => {
      await refresh()
      setSpendTarget(null)
      showToast(variables.target.transaction ? 'Spend record updated.' : 'Expense recorded in transactions and linked to this campaign.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const deleteSpendMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.remove(id),
    onSuccess: async () => {
      await refresh()
      setSpendToDelete(null)
      showToast('Spend record deleted from transactions.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  if (campaignsQuery.isLoading || categoriesQuery.isLoading || accountsQuery.isLoading) {
    return <LoadingState label="Loading expense campaigns…" />
  }
  if (campaignsQuery.isError || categoriesQuery.isError || accountsQuery.isError || !campaignsQuery.data || !categoriesQuery.data || !accountsQuery.data) {
    return <div role="alert" className="text-sm text-[var(--danger)]">Expense campaigns couldn’t be loaded.</div>
  }

  const activeCampaigns = campaignsQuery.data.filter((campaign) => campaign.status === 'PLANNED')
  const totals = activeCampaigns.reduce((summary, campaign) => ({
    estimated: summary.estimated + campaign.summary.estimatedAmount,
    spent: summary.spent + campaign.summary.spentAmount,
    remaining: summary.remaining + campaign.summary.remainingAmount,
  }), { estimated: 0, spent: 0, remaining: 0 })
  const visibleCampaigns = campaignsQuery.data.filter((campaign) => campaign.status === activeStatus)
  const availableCategories = categoriesQuery.data.filter((category) => !category.isArchived)
  const availableAccounts = accountsQuery.data.filter((account) => !account.isArchived && account.isActive)

  function resetCampaignForm() {
    campaignForm.reset({
      name: '', dueDate: '', notes: '',
      items: [{ name: '', categoryId: '', estimatedAmount: undefined }],
    })
  }

  function closeCampaignForm() {
    addForm.close()
    setEditingCampaign(null)
    resetCampaignForm()
  }

  function openAddCampaign() {
    setEditingCampaign(null)
    resetCampaignForm()
  }

  function editCampaign(campaign: PlannedExpense) {
    addForm.close()
    setEditingCampaign(campaign)
    campaignForm.reset({
      name: campaign.name,
      dueDate: campaign.dueDate ?? '',
      notes: campaign.notes,
      items: campaign.items.map((item) => ({
        id: item.id,
        name: item.name,
        categoryId: item.categoryId ?? '',
        estimatedAmount: item.estimatedAmount,
      })),
    })
  }

  function openSpend(
    campaign: PlannedExpense,
    item: PlannedExpense['items'][number],
    transaction?: PlannedExpense['items'][number]['transactions'][number],
  ) {
    spendForm.reset({
      amount: transaction?.amount,
      transactionDate: transaction?.date ?? todayISO(),
      accountId: transaction?.accountId ?? '',
      paymentMode: transaction?.paymentMode ?? 'UPI',
      note: transaction?.note ?? '',
    })
    setSpendTarget({ campaign, itemId: item.id, itemName: item.name, categoryId: item.categoryId, transaction })
  }

  function submitCampaign(values: CampaignForm) {
    saveMutation.mutate({
      ...values,
      dueDate: values.dueDate || null,
      notes: values.notes?.trim() || '',
    })
  }

  function submitSpend(values: SpendForm) {
    if (!spendTarget) return
    if (spendTarget.itemId === 'legacy' && !spendTarget.categoryId && !values.categoryId) {
      spendForm.setError('categoryId', { message: 'Choose a category for this expense' })
      return
    }
    spendMutation.mutate({ target: spendTarget, values })
  }

  function toggleExpanded(id: string) {
    setExpandedCampaigns((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--primary)]">Plan and track actuals</p>
          <h2 className="mt-1 text-2xl font-semibold">Expense campaigns</h2>
        </div>
        <Link to="/planned-expenses?add=1" onClick={openAddCampaign}>
          <Button><Plus className="h-4 w-4" />New campaign</Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Active campaign estimates</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatINR(totals.estimated)}</p></Card>
        <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Actual spend</p><p className="mt-2 text-xl font-semibold tabular-nums">{formatINR(totals.spent)}</p></Card>
        <Card className="p-4"><p className="text-sm text-[var(--secondary)]">Estimate remaining</p><p className={`mt-2 text-xl font-semibold tabular-nums ${totals.remaining < 0 ? 'text-[var(--danger)]' : ''}`}>{formatINR(totals.remaining)}</p></Card>
      </div>

      <div className="inline-flex max-w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1" role="tablist" aria-label="Campaign status">
        {statusTabs.map((tab) => (
          <button key={tab.value} type="button" role="tab" aria-selected={activeStatus === tab.value} onClick={() => setActiveStatus(tab.value)} className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeStatus === tab.value ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm' : 'text-[var(--secondary)] hover:text-[var(--foreground)]'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <section className="space-y-3" aria-label={`${activeStatus.toLowerCase()} expense campaigns`}>
        {visibleCampaigns.length ? visibleCampaigns.map((campaign) => {
          const expanded = expandedCampaigns.has(campaign.id)
          return (
            <Card key={campaign.id} className="relative overflow-visible p-0">
              <div className="p-4 sm:p-5">
                <div className="flex w-full items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]"><CalendarDays className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-semibold">{campaign.name}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--secondary)]">
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{campaign.dueDate ? formatDate(campaign.dueDate) : 'Date not set'}</span>
                      <span aria-hidden="true">·</span><span>{campaign.items.length} estimate lines</span>
                      <span aria-hidden="true">·</span><span>{campaign.summary.transactionCount} transactions</span>
                    </p>
                    {campaign.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--secondary)]">{campaign.notes}</p> : null}
                  </div>
                </div>
                <div className="relative ml-auto shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label={`Campaign actions for ${campaign.name}`}
                    aria-expanded={campaignActionsId === campaign.id}
                    aria-haspopup="menu"
                    onClick={() => setCampaignActionsId((current) => current === campaign.id ? null : campaign.id)}
                  >
                    <EllipsisVertical className="h-5 w-5" />
                  </Button>
                  {campaignActionsId === campaign.id ? (
                    <div role="menu" className="absolute right-0 top-full z-50 mt-1 flex w-56 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
                      {campaign.status === 'PLANNED' ? <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" onClick={() => { setCampaignActionsId(null); editCampaign(campaign) }}>
                        <Pencil className="h-4 w-4" />Edit campaign
                      </Button> : null}
                      {campaign.status === 'PLANNED' ? (
                        <>
                          <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={campaignStatusMutation.isPending} onClick={() => campaignStatusMutation.mutate({ id: campaign.id, status: 'COMPLETED' })}>
                            <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />Mark completed
                          </Button>
                          <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={campaignStatusMutation.isPending} onClick={() => campaignStatusMutation.mutate({ id: campaign.id, status: 'CANCELLED' })}>
                            <Ban className="h-4 w-4 text-[var(--danger)]" />Cancel campaign
                          </Button>
                        </>
                      ) : (
                        <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3" disabled={campaignStatusMutation.isPending} onClick={() => campaignStatusMutation.mutate({ id: campaign.id, status: 'PLANNED' })}>
                          <RotateCcw className="h-4 w-4" />Reopen campaign
                        </Button>
                      )}
                      {campaign.status === 'PLANNED' ? <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 whitespace-nowrap px-3 text-[var(--danger)]" disabled={campaign.summary.transactionCount > 0} title={campaign.summary.transactionCount ? 'Campaigns with spend history cannot be deleted; cancel it instead' : undefined} onClick={() => { setCampaignActionsId(null); setCampaignToDelete(campaign) }}>
                        <Trash2 className="h-4 w-4" />Delete campaign
                      </Button> : null}
                    </div>
                  ) : null}
                </div>
                </div>
                <div className="mt-4 flex w-full items-center gap-2 border-t border-[var(--border)] pt-3">
                  <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 text-right">
                    <div className="min-w-0"><p className="text-[11px] text-[var(--secondary)]">Planned</p><p className="mt-1 break-words text-xs font-semibold tabular-nums sm:text-sm">{formatINR(campaign.summary.estimatedAmount)}</p></div>
                    <div className="min-w-0"><p className="text-[11px] text-[var(--secondary)]">Spent</p><p className="mt-1 break-words text-xs font-semibold tabular-nums sm:text-sm">{formatINR(campaign.summary.spentAmount)}</p></div>
                    <div className="min-w-0"><p className="text-[11px] text-[var(--secondary)]">Left</p><p className={`mt-1 break-words text-xs font-semibold tabular-nums sm:text-sm ${campaign.summary.remainingAmount < 0 ? 'text-[var(--danger)]' : ''}`}>{formatINR(campaign.summary.remainingAmount)}</p></div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label={expanded ? 'Hide breakdown' : 'View breakdown'}
                    title={expanded ? 'Hide breakdown' : 'View breakdown'}
                    aria-expanded={expanded}
                    onClick={() => toggleExpanded(campaign.id)}
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {expanded ? (
                <div className="border-t border-[var(--border)]">
                  <div className="divide-y divide-[var(--border)]">
                    {campaign.items.map((item) => (
                      <div key={item.id} className="px-4 py-4 sm:px-5 sm:py-5">
                        <div className="space-y-4">
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(440px,auto)] xl:items-center">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.name}</p>
                            <p className="mt-1 text-xs text-[var(--secondary)]">{item.categoryName ?? 'Uncategorized'}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2 xl:grid-cols-3 xl:items-center xl:gap-4">
                            <div className="min-w-0"><p className="text-xs text-[var(--secondary)]">Estimate</p><p className="mt-1 truncate text-sm font-semibold tabular-nums">{formatINR(item.estimatedAmount)}</p></div>
                            <div className="min-w-0"><p className="text-xs text-[var(--secondary)]">Actual</p><p className="mt-1 truncate text-sm font-semibold tabular-nums">{formatINR(item.spentAmount)}</p></div>
                            <div className="min-w-0"><p className="text-xs text-[var(--secondary)]">Remaining</p><p className={`mt-1 truncate text-sm font-semibold tabular-nums ${item.remainingAmount < 0 ? 'text-[var(--danger)]' : ''}`}>{formatINR(item.remainingAmount)}</p></div>
                          </div>
                        </div>
                        {campaign.status === 'PLANNED' ? <Button size="sm" className="justify-center flex-nowrap gap-2 whitespace-nowrap px-4 sm:w-[15rem]" onClick={() => openSpend(campaign, item)}><ReceiptText className="h-4 w-4 shrink-0" /><span className="shrink-0 whitespace-nowrap">Record spend</span></Button> : null}
                        </div>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]" role="progressbar" aria-label={`${item.name} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, item.spendingPercent)}>
                          <div className={`h-full rounded-full transition-[width] ${item.spendingPercent > 100 ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'}`} style={{ width: `${Math.min(100, item.spendingPercent)}%` }} />
                        </div>
                        {item.transactions.length ? (
                          <ul className="ml-1 mt-3 divide-y divide-[var(--border)] border-l-2 border-[var(--border)] pl-3 sm:ml-2 sm:pl-4">
                            {item.transactions.map((transaction) => (
                              <li key={transaction.id} className={`grid items-center gap-2 py-2.5 text-xs ${campaign.status === 'PLANNED' ? 'grid-cols-[minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto]'}`}>
                                <span className="inline-flex min-w-0 items-center gap-2 text-[var(--secondary)]"><Wallet className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 truncate">{formatDate(transaction.date)}{transaction.note ? ` · ${transaction.note}` : ''}</span></span>
                                <span className="shrink-0 text-right font-medium tabular-nums">{formatINR(transaction.amount - transaction.refundedAmount)}{transaction.refundedAmount ? <span className="ml-1 text-[var(--secondary)]">(refund {formatINR(transaction.refundedAmount)})</span> : null}</span>
                                {campaign.status === 'PLANNED' ? <div className="relative">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9"
                                    aria-label={`Actions for spend on ${formatDate(transaction.date)}`}
                                    aria-expanded={spendActionsId === transaction.id}
                                    aria-haspopup="menu"
                                    onClick={() => setSpendActionsId((current) => current === transaction.id ? null : transaction.id)}
                                  >
                                    <EllipsisVertical className="h-4 w-4" />
                                  </Button>
                                  {spendActionsId === transaction.id ? (
                                    <div role="menu" className="absolute right-0 top-full z-20 mt-1 flex w-40 flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
                                      <Button role="menuitem" variant="ghost" className="min-h-11 justify-start" onClick={() => { setSpendActionsId(null); openSpend(campaign, item, transaction) }}>
                                        <Pencil className="h-4 w-4" />Edit record
                                      </Button>
                                      <Button role="menuitem" variant="ghost" className="min-h-11 justify-start text-[var(--danger)]" disabled={deleteSpendMutation.isPending || transaction.refundedAmount > 0} title={transaction.refundedAmount > 0 ? 'Delete the linked refund first' : undefined} onClick={() => { setSpendActionsId(null); setSpendToDelete({ campaign, itemId: item.id, itemName: item.name, categoryId: item.categoryId, transaction }) }}>
                                        <Trash2 className="h-4 w-4" />Delete record
                                      </Button>
                                    </div>
                                  ) : null}
                                </div> : null}
                              </li>
                            ))}
                          </ul>
                        ) : <p className="mt-3 text-xs text-[var(--secondary)]">No transactions recorded yet.</p>}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-[var(--border)] bg-[var(--muted)]/50 px-4 py-3 text-sm sm:px-5">
                    <span className="font-medium">Campaign utilization</span>
                    <span className={campaign.summary.spendingPercent > 100 ? 'font-semibold text-[var(--danger)]' : 'font-semibold'}>{campaign.summary.spendingPercent}%{campaign.summary.overBudgetAmount > 0 ? ` · ${formatINR(campaign.summary.overBudgetAmount)} over estimate` : ''}</span>
                  </div>
                </div>
              ) : null}
            </Card>
          )
        }) : <Card className="p-8 text-center text-sm text-[var(--secondary)]">{activeStatus === 'PLANNED' ? 'No campaigns yet.' : `No ${activeStatus.toLowerCase()} campaigns.`}</Card>}
      </section>

      <Modal open={addForm.isOpen || !!editingCampaign} onClose={closeCampaignForm} title={editingCampaign ? 'Edit campaign' : 'Create expense campaign'} className="sm:max-w-3xl">
        <form className="space-y-5" onSubmit={campaignForm.handleSubmit(submitCampaign)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="campaign-name" className="space-y-2 text-sm font-medium">Campaign name<Input id="campaign-name" placeholder="Three weddings this summer" {...campaignForm.register('name')} error={campaignForm.formState.errors.name?.message} /></label>
            <label htmlFor="campaign-date" className="space-y-2 text-sm font-medium">Target date (optional)<Input id="campaign-date" type="date" {...campaignForm.register('dueDate')} /></label>
            <label htmlFor="campaign-notes" className="space-y-2 text-sm font-medium sm:col-span-2">Notes<textarea id="campaign-notes" rows={2} className={`${fieldClass} h-auto py-2`} {...campaignForm.register('notes')} /></label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Estimate lines</h3><Button type="button" size="sm" variant="outline" onClick={() => itemFields.append({ name: '', categoryId: '', estimatedAmount: 0 })}><Plus className="h-4 w-4" />Add line</Button></div>
            {campaignForm.formState.errors.items?.root?.message ? <p role="alert" className="text-xs text-[var(--danger)]">{campaignForm.formState.errors.items.root.message}</p> : null}
            {itemFields.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end">
                <input type="hidden" {...campaignForm.register(`items.${index}.id`)} />
                <label htmlFor={`campaign-item-name-${index}`} className="space-y-2 text-xs font-medium">Expense item<Input id={`campaign-item-name-${index}`} placeholder="Travel, gift, outfit…" {...campaignForm.register(`items.${index}.name`)} error={campaignForm.formState.errors.items?.[index]?.name?.message} /></label>
                <label htmlFor={`campaign-item-category-${index}`} className="space-y-2 text-xs font-medium">Category<select id={`campaign-item-category-${index}`} className={fieldClass} {...campaignForm.register(`items.${index}.categoryId`)}><option value="">Select category</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{campaignForm.formState.errors.items?.[index]?.categoryId?.message ? <span className="text-xs text-[var(--danger)]">{campaignForm.formState.errors.items[index]?.categoryId?.message}</span> : null}</label>
                <label htmlFor={`campaign-item-amount-${index}`} className="space-y-2 text-xs font-medium">Estimate (₹)<Input id={`campaign-item-amount-${index}`} type="number" min="0.01" step="0.01" {...campaignForm.register(`items.${index}.estimatedAmount`, { valueAsNumber: true })} error={campaignForm.formState.errors.items?.[index]?.estimatedAmount?.message} /></label>
                <Button type="button" size="icon" variant="ghost" disabled={itemFields.fields.length < 2} onClick={() => itemFields.remove(index)} aria-label={`Remove estimate line ${index + 1}`}><Trash2 className="h-4 w-4 text-[var(--danger)]" /></Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeCampaignForm}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : editingCampaign ? 'Save changes' : 'Create campaign'}</Button></div>
        </form>
      </Modal>

      <Modal open={!!spendTarget} onClose={() => { if (!spendMutation.isPending) setSpendTarget(null) }} title={spendTarget?.transaction ? 'Edit spend record' : 'Record an actual expense'} className="sm:max-w-xl">
        {spendTarget ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={spendForm.handleSubmit(submitSpend)} noValidate>
          <div className="sm:col-span-2"><p className="font-medium">{spendTarget.campaign.name}</p><p className="mt-1 text-sm text-[var(--secondary)]">{spendTarget.itemName}</p></div>
          <label htmlFor="spend-amount" className="space-y-2 text-sm font-medium">Amount (₹)<Input id="spend-amount" type="number" min="0.01" step="0.01" autoFocus {...spendForm.register('amount', { valueAsNumber: true })} error={spendForm.formState.errors.amount?.message} /></label>
          <label htmlFor="spend-date" className="space-y-2 text-sm font-medium">Date<Input id="spend-date" type="date" {...spendForm.register('transactionDate')} /></label>
          <label htmlFor="spend-account" className="space-y-2 text-sm font-medium">Account<select id="spend-account" className={fieldClass} {...spendForm.register('accountId')}><option value="">Select account</option>{availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{spendForm.formState.errors.accountId?.message ? <span className="text-xs text-[var(--danger)]">{spendForm.formState.errors.accountId.message}</span> : null}</label>
          <label htmlFor="spend-mode" className="space-y-2 text-sm font-medium">Payment mode<select id="spend-mode" className={fieldClass} {...spendForm.register('paymentMode')}>{paymentModes.map((mode) => <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>)}</select></label>
          {spendTarget.itemId === 'legacy' && !spendTarget.categoryId ? <label htmlFor="spend-category" className="space-y-2 text-sm font-medium">Expense category<select id="spend-category" className={fieldClass} {...spendForm.register('categoryId')}><option value="">Select category</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{spendForm.formState.errors.categoryId?.message ? <span className="text-xs text-[var(--danger)]">{spendForm.formState.errors.categoryId.message}</span> : null}</label> : null}
          <label htmlFor="spend-note" className="space-y-2 text-sm font-medium sm:col-span-2">Note (optional)<Input id="spend-note" placeholder="Train tickets" {...spendForm.register('note')} /></label>
          {!spendTarget.transaction ? <div className="rounded-lg bg-[var(--muted)] p-3 text-xs leading-5 text-[var(--secondary)] sm:col-span-2">This will create a regular expense transaction under {spendTarget.campaign.name} / {spendTarget.itemName}.</div> : null}
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setSpendTarget(null)}>Cancel</Button><Button type="submit" disabled={spendMutation.isPending}><ReceiptText className="h-4 w-4" />{spendMutation.isPending ? 'Saving…' : spendTarget.transaction ? 'Save changes' : 'Record transaction'}</Button></div>
        </form> : null}
      </Modal>

      {spendToDelete?.transaction ? <Modal open onClose={() => { if (!deleteSpendMutation.isPending) setSpendToDelete(null) }} title="Delete spend record?" className="sm:max-w-md">
        <p className="text-sm leading-6 text-[var(--secondary)]">This will delete the <span className="font-semibold text-[var(--foreground)]">{formatINR(spendToDelete.transaction.amount)}</span> transaction from <span className="font-semibold text-[var(--foreground)]">{spendToDelete.campaign.name} / {spendToDelete.itemName}</span>. The campaign actuals and account balance will be recalculated.</p>
        <div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={deleteSpendMutation.isPending} onClick={() => setSpendToDelete(null)}>Keep record</Button><Button variant="danger" disabled={deleteSpendMutation.isPending || spendToDelete.transaction.refundedAmount > 0} onClick={() => deleteSpendMutation.mutate(spendToDelete.transaction!.id)}>{deleteSpendMutation.isPending ? 'Deleting…' : 'Delete record'}</Button></div>
      </Modal> : null}

      {campaignToDelete ? <Modal open onClose={() => { if (!deleteMutation.isPending) setCampaignToDelete(null) }} title="Delete campaign?" className="sm:max-w-md">
        <p className="text-sm leading-6 text-[var(--secondary)]">Delete <span className="font-semibold text-[var(--foreground)]">{campaignToDelete.name}</span>? Campaigns with recorded transactions must be cancelled instead so their ledger links remain intact.</p>
        <div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={deleteMutation.isPending} onClick={() => setCampaignToDelete(null)}>Keep campaign</Button><Button variant="danger" disabled={deleteMutation.isPending || campaignToDelete.summary.transactionCount > 0} onClick={() => deleteMutation.mutate(campaignToDelete.id)}>{deleteMutation.isPending ? 'Deleting…' : 'Delete campaign'}</Button></div>
      </Modal> : null}
    </div>
  )
}