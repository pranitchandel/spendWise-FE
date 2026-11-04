import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, EllipsisVertical, Flag, LockKeyhole, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { accountsApi } from '@/api/accounts'
import { getErrorMessage } from '@/api/client'
import { categoriesApi } from '@/api/categories'
import { transactionsApi, type TransactionInput } from '@/api/transactions'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/date'
import type { CategoryType, Transaction, TransactionType } from '@/types'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const transactionTypes = [
  'EXPENSE', 'INCOME', 'LENDING', 'BORROWING', 'LENDING_REPAYMENT',
  'BORROWING_REPAYMENT', 'TRANSFER', 'REFUND',
] as const
const paymentModes = ['UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'NET_BANKING', 'OTHER'] as const
const categoryType: Record<TransactionType, CategoryType> = {
  EXPENSE: 'EXPENSE',
  INCOME: 'INCOME',
  LENDING: 'LENDING',
  BORROWING: 'BORROWING',
  LENDING_REPAYMENT: 'LENDING',
  BORROWING_REPAYMENT: 'BORROWING',
  TRANSFER: 'TRANSFER',
  REFUND: 'EXPENSE',
}

const transactionSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  transactionDate: z.string().min(1, 'Choose a date'),
  transactionTime: z.string().optional(),
  type: z.enum(transactionTypes),
  categoryId: z.string().min(1, 'Choose a category'),
  paymentMode: z.enum(paymentModes),
  accountId: z.string().min(1, 'Choose an account'),
  toAccountId: z.string().optional(),
  description: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
  tags: z.string().optional(),
  personName: z.string().optional(),
  linkedRecordId: z.string().optional(),
  linkedTransactionId: z.string().optional(),
  interestAmount: z.number().min(0).optional(),
}).superRefine((values, context) => {
  if (values.type === 'TRANSFER' && !values.toAccountId) {
    context.addIssue({ code: 'custom', path: ['toAccountId'], message: 'Choose a destination account' })
  }
  if ((values.type === 'LENDING_REPAYMENT' || values.type === 'BORROWING_REPAYMENT') && !values.linkedRecordId) {
    context.addIssue({ code: 'custom', path: ['linkedRecordId'], message: 'Enter the linked record ID' })
  }
  if (values.type === 'REFUND' && !values.linkedTransactionId) {
    context.addIssue({ code: 'custom', path: ['linkedTransactionId'], message: 'Enter the original expense ID' })
  }
})

type TransactionFormValues = z.infer<typeof transactionSchema>

function currentISTDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function isCredit(type: TransactionType) {
  return type === 'INCOME' || type === 'BORROWING' || type === 'LENDING_REPAYMENT' || type === 'REFUND'
}

function campaignLocksTransaction(transaction: Transaction) {
  return transaction.plannedExpenseStatus === 'COMPLETED' || transaction.plannedExpenseStatus === 'CANCELLED'
}

function isCampaignTransaction(transaction: Transaction) {
  return Boolean(transaction.plannedExpenseId || transaction.plannedExpenseStatus)
}

function campaignStatusLabel(transaction: Transaction) {
  if (transaction.plannedExpenseStatus === 'COMPLETED') return 'Campaign · Completed'
  if (transaction.plannedExpenseStatus === 'CANCELLED') return 'Campaign · Cancelled'
  return isCampaignTransaction(transaction) ? 'Campaign' : null
}

function CampaignTransactionBadge({ transaction }: { transaction: Transaction }) {
  if (!isCampaignTransaction(transaction)) return null
  const Icon = campaignLocksTransaction(transaction) ? LockKeyhole : Flag
  const statusColor = transaction.plannedExpenseStatus === 'COMPLETED'
    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400'
    : transaction.plannedExpenseStatus === 'CANCELLED'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
      : 'border-[var(--border)] bg-[var(--muted)] text-[var(--secondary)]'
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-4 ${statusColor}`}>
      <Icon className="h-3 w-3" />{campaignStatusLabel(transaction)}
    </span>
  )
}

function transactionColor(type: TransactionType) {
  if (type === 'INCOME') return 'text-green-700 dark:text-green-400'
  if (type === 'BORROWING') return 'text-blue-700 dark:text-blue-400'
  if (type === 'LENDING_REPAYMENT' || type === 'REFUND') return 'text-teal-700 dark:text-teal-400'
  if (type === 'EXPENSE' || type === 'LENDING' || type === 'BORROWING_REPAYMENT') {
    return 'text-[var(--danger)]'
  }
  return 'text-[var(--secondary)]'
}

function transactionIconBackground(type: TransactionType) {
  if (type === 'INCOME') return 'bg-green-50 dark:bg-green-950/40'
  if (type === 'BORROWING') return 'bg-blue-50 dark:bg-blue-950/40'
  if (type === 'LENDING_REPAYMENT' || type === 'REFUND') return 'bg-teal-50 dark:bg-teal-950/40'
  if (type === 'EXPENSE' || type === 'LENDING' || type === 'BORROWING_REPAYMENT') {
    return 'bg-red-50 dark:bg-red-950/40'
  }
  return 'bg-[var(--muted)]'
}

export function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [type, setType] = useState<TransactionType | ''>('')
  const [searchParams, setSearchParams] = useSearchParams()
  const addOpen = searchParams.get('add') === '1'
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [mobileActionsId, setMobileActionsId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  useEffect(() => {
    const normalizedSearch = search.trim()
    if (!normalizedSearch) {
      setDebouncedSearch('')
      return
    }

    const timeout = window.setTimeout(() => setDebouncedSearch(normalizedSearch), 500)
    return () => window.clearTimeout(timeout)
  }, [search])

  const transactionsQuery = useQuery({
    queryKey: ['transactions', debouncedSearch, type],
    queryFn: () => transactionsApi.list({ page: 1, limit: 100, search: debouncedSearch, type }),
  })
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list({ includeArchived: true }) })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      setTransactionToDelete(null)
      showToast('Transaction deleted.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  if (transactionsQuery.isLoading || accountsQuery.isLoading || categoriesQuery.isLoading) return <LoadingState label="Loading transactions…" />
  if (transactionsQuery.isError || accountsQuery.isError || categoriesQuery.isError) {
    return <div role="alert" className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--danger)]">Transactions couldn’t be loaded. Refresh to try again.</div>
  }
  if (!transactionsQuery.data || !accountsQuery.data || !categoriesQuery.data) return <LoadingState label="Loading transactions…" />

  const accountNames = new Map(accountsQuery.data.map((account) => [account.id, account.name]))
  const categoryNames = new Map(categoriesQuery.data.map((category) => [category.id, category.name]))
  const grouped = transactionsQuery.data.items.reduce<Record<string, typeof transactionsQuery.data.items>>((days, transaction) => {
    ;(days[transaction.transactionDate] ??= []).push(transaction)
    return days
  }, {})

  function closeAddModal() {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('add')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--primary)]">Ledger</p><h2 className="mt-1 text-2xl font-semibold">Transactions</h2></div>
        <Link to="/transactions?add=1"><Button><Plus className="h-4 w-4" />Add transaction</Button></Link>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1" htmlFor="transaction-search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--secondary)]" />
          <Input id="transaction-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description, note, or tag" className="pl-9" />
        </label>
        <label htmlFor="transaction-type" className="sr-only">Filter by transaction type</label>
        <select id="transaction-type" value={type} onChange={(event) => setType(event.target.value as TransactionType | '')} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]">
          <option value="">All types</option>
          {transactionTypes.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
        </select>
      </div>
      {transactionsQuery.data.items.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--muted)] text-[var(--primary)]"><ArrowLeftRight className="h-5 w-5" /></div>
          <h3 className="mt-4 font-semibold">No transactions found</h3>
          <p className="mt-1 text-sm text-[var(--secondary)]">Add your first entry or adjust the search filters.</p>
        </Card>
      ) : Object.entries(grouped).map(([date, items]) => (
        <section key={date}>
          <div className="mb-2 flex items-center justify-between px-1"><h3 className="text-sm font-semibold">{formatDate(date)}</h3><span className="text-xs text-[var(--secondary)]">{items.length} {items.length === 1 ? 'entry' : 'entries'}</span></div>
          <Card className="divide-y divide-[var(--border)] overflow-hidden">
            {items.map((transaction) => (
              <article key={transaction.id} className="relative">
                <div className="flex align-items-start gap-2 px-3 py-3 md:hidden">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${transactionIconBackground(transaction.type)} ${transactionColor(transaction.type)}`}>
                    {isCredit(transaction.type) ? <ArrowDownLeft className="h-4 w-4" /> : transaction.type === 'TRANSFER' ? <ArrowLeftRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold leading-5">{transaction.description || transaction.type.replaceAll('_', ' ').toLowerCase()}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[13px] font-semibold tabular-nums ${transactionColor(transaction.type)}`}>{isCredit(transaction.type) ? '+' : transaction.type === 'TRANSFER' ? '' : '−'}{money.format(transaction.amount)}</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase text-[var(--secondary)]">{transaction.type.replaceAll('_', ' ')}</p>
                  </div>
                  {!campaignLocksTransaction(transaction) ? <div className="relative shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-9"
                      aria-label={`Actions for ${transaction.type.toLowerCase().replaceAll('_', ' ')} transaction`}
                      aria-expanded={mobileActionsId === transaction.id}
                      aria-haspopup="menu"
                      onClick={() => setMobileActionsId((current) => current === transaction.id ? null : transaction.id)}
                    >
                      <EllipsisVertical className="h-5 w-5" />
                    </Button>
                    {mobileActionsId === transaction.id ? (
                      <div role="menu" className="absolute right-0 top-full z-20 mt-1 flex w-40 flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
                        <Button role="menuitem" variant="ghost" className="min-h-11 justify-start" onClick={() => { setEditingTransaction(transaction); setMobileActionsId(null) }}><Pencil className="h-4 w-4" />Edit</Button>
                        <Button role="menuitem" variant="ghost" className="min-h-11 justify-start text-[var(--danger)]" disabled={deleteMutation.isPending} onClick={() => { setTransactionToDelete(transaction); setMobileActionsId(null) }}><Trash2 className="h-4 w-4" />Delete</Button>
                      </div>
                    ) : null}
                  </div> : null}
                </div>
                <div className="ml-14 flex flex-col items-start gap-1.5 pb-3 pr-12 md:hidden">
                  <span className="max-w-full break-words rounded-md bg-[var(--muted)] py-1 text-xs font-medium leading-4 text-[var(--foreground)]">
                    {categoryNames.get(transaction.categoryId) ?? 'Uncategorized'}
                  </span>
                  {transaction.type === 'TRANSFER' ? (
                    <p className="flex max-w-full flex-wrap items-center gap-x-1 break-words text-xs leading-4 text-[var(--secondary)]">
                      <span>{accountNames.get(transaction.accountId) ?? 'Account'}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>{transaction.toAccountId ? accountNames.get(transaction.toAccountId) ?? 'Account' : 'Account'}</span>
                    </p>
                  ) : (
                    <p className="break-words text-xs leading-4 text-[var(--secondary)]">{accountNames.get(transaction.accountId) ?? 'Account'}</p>
                  )}
                  <div className="flex max-w-full flex-wrap items-center gap-1.5">
                    <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] leading-4 text-[var(--secondary)]">
                      {transaction.paymentMode.replaceAll('_', ' ')}
                    </span>
                    <CampaignTransactionBadge transaction={transaction} />
                  </div>
                </div>

                <div className="flex items-center gap-3 px-4 py-4 sm:px-5 max-md:hidden">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${transactionIconBackground(transaction.type)} ${transactionColor(transaction.type)}`}>
                    {isCredit(transaction.type) ? <ArrowDownLeft className="h-4 w-4" /> : transaction.type === 'TRANSFER' ? <ArrowLeftRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-start"><p className="max-w-full truncate text-sm font-medium">{transaction.description || transaction.type.replaceAll('_', ' ').toLowerCase()}</p><div className="mt-1 flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1"><p className="min-w-0 truncate text-xs text-[var(--secondary)]">{categoryNames.get(transaction.categoryId) ?? 'Uncategorized'} · {accountNames.get(transaction.accountId) ?? 'Account'} · {transaction.paymentMode.replaceAll('_', ' ')}</p><CampaignTransactionBadge transaction={transaction} /></div></div>
                  <div className="shrink-0 text-right"><p className={`text-sm font-semibold tabular-nums ${transactionColor(transaction.type)}`}>{isCredit(transaction.type) ? '+' : transaction.type === 'TRANSFER' ? '' : '−'}{money.format(transaction.amount)}</p><p className="mt-1 text-[10px] font-semibold uppercase text-[var(--secondary)]">{transaction.type.replaceAll('_', ' ')}</p></div>
                  {!campaignLocksTransaction(transaction) ? <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${transaction.type.toLowerCase().replaceAll('_', ' ')} transaction`} onClick={() => setEditingTransaction(transaction)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${transaction.type.toLowerCase().replaceAll('_', ' ')} transaction`} disabled={deleteMutation.isPending} onClick={() => setTransactionToDelete(transaction)}><Trash2 className="h-4 w-4 text-[var(--danger)]" /></Button>
                  </div> : null}
                </div>

              </article>
            ))}
          </Card>
        </section>
      ))}
      {transactionToDelete ? (
        <Modal open onClose={() => { if (!deleteMutation.isPending) setTransactionToDelete(null) }} title="Delete transaction?" className="sm:max-w-md">
          <p className="text-sm leading-6 text-[var(--secondary)]">This cannot be undone. Deleting this ledger entry may affect associated account balances and repayments.</p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => setTransactionToDelete(null)}>Cancel</Button>
            <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(transactionToDelete.id)}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete transaction'}
            </Button>
          </div>
        </Modal>
      ) : null}
      {addOpen || editingTransaction ? <TransactionFormModal transaction={editingTransaction ?? undefined} onClose={() => { closeAddModal(); setEditingTransaction(null) }} /> : null}
    </div>
  )
}

function TransactionFormModal({ onClose, transaction }: { onClose: () => void; transaction?: Transaction }) {
  const queryClient = useQueryClient()
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list() })
  const { showToast } = useToast()
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      transactionDate: currentISTDate(),
      transactionTime: '',
      type: 'EXPENSE',
      categoryId: '',
      paymentMode: 'UPI',
      accountId: '',
      toAccountId: '',
      description: '',
      note: '',
      tags: '',
      personName: '',
      linkedRecordId: '',
      linkedTransactionId: '',
      interestAmount: 0,
    },
  })
  useEffect(() => {
    if (!transaction) return
    form.reset({
      amount: transaction.amount,
      transactionDate: transaction.transactionDate,
      transactionTime: transaction.transactionTime,
      type: transaction.type,
      categoryId: transaction.categoryId,
      paymentMode: transaction.paymentMode,
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId ?? '',
      description: transaction.description,
      note: transaction.note,
      tags: transaction.tags.join(', '),
      personName: '',
      linkedRecordId: transaction.linkedRecordId ?? '',
      linkedTransactionId: transaction.linkedTransactionId ?? '',
      interestAmount: transaction.interest ?? 0,
    })
  }, [form, transaction])
  const selectedType = form.watch('type')
  const availableCategories = categoriesQuery.data?.filter((category) => category.type === categoryType[selectedType]) ?? []

  const createMutation = useMutation({
    mutationFn: (input: TransactionInput) => transaction
      ? transactionsApi.update(transaction.id, input)
      : transactionsApi.create(input, crypto.randomUUID()),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      showToast(transaction ? 'Transaction updated.' : 'Transaction added.', 'success')
      onClose()
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  function submit(values: TransactionFormValues) {
    const input: TransactionInput = {
      amount: values.amount,
      transactionDate: values.transactionDate,
      transactionTime: values.transactionTime || undefined,
      type: values.type,
      categoryId: values.categoryId,
      paymentMode: values.paymentMode,
      accountId: values.accountId,
      toAccountId: values.type === 'TRANSFER' ? values.toAccountId : undefined,
      description: values.description?.trim() || undefined,
      note: values.note?.trim() || undefined,
      tags: values.tags?.split(',').map((tag) => tag.trim()).filter(Boolean),
      personName: values.personName?.trim() || undefined,
      linkedRecordId: values.linkedRecordId?.trim() || undefined,
      linkedTransactionId: values.linkedTransactionId?.trim() || undefined,
      interestAmount: values.interestAmount,
    }
    createMutation.mutate(input)
  }

  const loading = accountsQuery.isLoading || categoriesQuery.isLoading
  if (accountsQuery.isError || categoriesQuery.isError) {
    return <Modal open onClose={onClose} title="Add transaction"><div role="alert" className="text-sm text-[var(--danger)]">Accounts or categories couldn’t be loaded.</div></Modal>
  }
  if (loading || !accountsQuery.data || !categoriesQuery.data) {
    return <Modal open onClose={onClose} title={transaction ? 'Edit transaction' : 'Add transaction'}><LoadingState label="Preparing transaction form…" /></Modal>
  }

  const fieldClass = 'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'

  return (
      <Modal open onClose={onClose} title={transaction ? 'Edit transaction' : 'Add transaction'} className="sm:max-w-3xl">
        <form className="space-y-6" onSubmit={form.handleSubmit(submit)} noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="amount">Amount
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--secondary)]">₹</span><Input id="amount" type="number" min="0.01" step="0.01" inputMode="decimal" className="pl-8 text-lg font-semibold tabular-nums" {...form.register('amount', { valueAsNumber: true })} error={form.formState.errors.amount?.message} /></div>
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="type">Transaction type
              <select id="type" disabled={!!transaction} className={fieldClass} {...form.register('type', { onChange: () => form.setValue('categoryId', '') })}>{transactionTypes.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select>
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="transactionDate">Date
              <Input id="transactionDate" type="date" {...form.register('transactionDate')} error={form.formState.errors.transactionDate?.message} />
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="categoryId">Category
              <select id="categoryId" className={fieldClass} {...form.register('categoryId')}><option value="">Select category</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              {form.formState.errors.categoryId?.message ? <span className="block text-xs text-[var(--danger)]">{form.formState.errors.categoryId.message}</span> : null}
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="paymentMode">Payment mode
              <select id="paymentMode" className={fieldClass} {...form.register('paymentMode')}>{paymentModes.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select>
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="accountId">Account
              <select id="accountId" className={fieldClass} {...form.register('accountId')}><option value="">Select account</option>{accountsQuery.data.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
              {form.formState.errors.accountId?.message ? <span className="block text-xs text-[var(--danger)]">{form.formState.errors.accountId.message}</span> : null}
            </label>
            {selectedType === 'TRANSFER' ? <label className="space-y-2 text-sm font-medium" htmlFor="toAccountId">Destination account
              <select id="toAccountId" className={fieldClass} {...form.register('toAccountId')}><option value="">Select destination</option>{accountsQuery.data.filter((account) => !account.isArchived && account.id !== form.watch('accountId')).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
              {form.formState.errors.toAccountId?.message ? <span className="block text-xs text-[var(--danger)]">{form.formState.errors.toAccountId.message}</span> : null}
            </label> : null}
            {!transaction && (selectedType === 'LENDING' || selectedType === 'BORROWING') ? <label className="space-y-2 text-sm font-medium" htmlFor="personName">{selectedType === 'LENDING' ? 'Person lent to' : 'Lender'}<Input id="personName" {...form.register('personName')} placeholder="Name" /></label> : null}
            {selectedType === 'LENDING_REPAYMENT' || selectedType === 'BORROWING_REPAYMENT' ? <>
              <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="linkedRecordId">Linked lending or borrowing record ID<Input id="linkedRecordId" readOnly={!!transaction} {...form.register('linkedRecordId')} error={form.formState.errors.linkedRecordId?.message} /></label>
              <label className="space-y-2 text-sm font-medium" htmlFor="interestAmount">Interest amount<Input id="interestAmount" type="number" min="0" step="0.01" {...form.register('interestAmount', { valueAsNumber: true })} /></label>
            </> : null}
            {selectedType === 'REFUND' ? <label className="space-y-2 text-sm font-medium sm:col-span-2" htmlFor="linkedTransactionId">Original expense transaction ID<Input id="linkedTransactionId" readOnly={!!transaction} {...form.register('linkedTransactionId')} error={form.formState.errors.linkedTransactionId?.message} /></label> : null}
            <label className="space-y-2 text-sm font-medium" htmlFor="description">Description<Input id="description" maxLength={500} {...form.register('description')} /></label>
            <label className="space-y-2 text-sm font-medium" htmlFor="transactionTime">Time<Input id="transactionTime" type="time" {...form.register('transactionTime')} /></label>
            <label className="space-y-2 text-sm font-medium" htmlFor="tags">Tags<Input id="tags" {...form.register('tags')} placeholder="Comma-separated" /></label>
            <label className="space-y-2 text-sm font-medium" htmlFor="note">Notes<textarea id="note" rows={3} className={`${fieldClass} h-auto py-3`} {...form.register('note')} /></label>
          </div>
          <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-5"><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving…' : transaction ? 'Save changes' : 'Save transaction'}</Button></div>
        </form>
      </Modal>
  )
}