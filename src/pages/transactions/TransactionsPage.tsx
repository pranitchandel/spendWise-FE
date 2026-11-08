import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, EllipsisVertical, Flag, LockKeyhole, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
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
import { CurrencyAmount } from '@/components/ui/CurrencyAmount'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { MobileFilterSheet } from '@/components/ui/MobileFilterSheet'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/date'
import type { CategoryType, Transaction, TransactionType } from '@/types'

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
function formatAccountFlowDetails(transaction: Transaction, accountNames: Map<string, string>) {
  const accountName = accountNames.get(transaction.accountId) ?? 'Account'
  if (transaction.type !== 'TRANSFER') return accountName
  if (transaction.savingsMovementDirection === 'DEPOSIT') return `${accountName} → Savings goal`
  if (transaction.savingsMovementDirection === 'WITHDRAWAL') return `Savings goal → ${accountName}`
  const destinationName = transaction.toAccountId ? accountNames.get(transaction.toAccountId) ?? 'Account' : 'Account'
  return `${accountName} → ${destinationName}`
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
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [draftCategoryId, setDraftCategoryId] = useState('')
  const [draftType, setDraftType] = useState<TransactionType | ''>('')
  const [draftFromDate, setDraftFromDate] = useState('')
  const [draftToDate, setDraftToDate] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [searchParams, setSearchParams] = useSearchParams()
  const addOpen = searchParams.get('add') === '1'
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null)
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
    queryKey: ['transactions', debouncedSearch, type, fromDate, toDate, categoryId, page],
    queryFn: () => transactionsApi.listPage({ page, limit: 20, search: debouncedSearch, type, from: fromDate, to: toDate, categoryId }),
    placeholderData: keepPreviousData,
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
  const activeFilterCount = Number(Boolean(type)) + Number(Boolean(fromDate)) + Number(Boolean(toDate)) + Number(Boolean(categoryId))

  const filtersDirty = draftType !== type || draftFromDate !== fromDate || draftToDate !== toDate || draftCategoryId !== categoryId

  function applyFilters() {
    setType(draftType)
    setFromDate(draftFromDate)
    setToDate(draftToDate)
    setCategoryId(draftCategoryId)
    setPage(1)
  }

  function clearFilters() {
    setDraftType('')
    setDraftFromDate('')
    setDraftToDate('')
    setDraftCategoryId('')
    setType('')
    setFromDate('')
    setToDate('')
    setCategoryId('')
    setPage(1)
  }

  function renderFilterFields(idPrefix: string) {
    const selectClass = 'h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'
    return <>
      <label htmlFor={`${idPrefix}-type`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">Type
        <select id={`${idPrefix}-type`} value={draftType} onChange={(event) => { setDraftType(event.target.value as TransactionType | ''); setDraftCategoryId('') }} className={selectClass}>
          <option value="">All types</option>
          {transactionTypes.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-category`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">Category
        <select id={`${idPrefix}-category`} value={draftCategoryId} onChange={(event) => setDraftCategoryId(event.target.value)} className={selectClass}>
          <option value="">All categories</option>
          {categoriesQuery.data?.filter((category) => !draftType || category.type === categoryType[draftType]).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-from`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">From date
        <Input id={`${idPrefix}-from`} type="date" value={draftFromDate} max={draftToDate || undefined} onChange={(event) => setDraftFromDate(event.target.value)} className="h-10" />
      </label>
      <label htmlFor={`${idPrefix}-to`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">To date
        <Input id={`${idPrefix}-to`} type="date" value={draftToDate} min={draftFromDate || undefined} onChange={(event) => setDraftToDate(event.target.value)} className="h-10" />
      </label>
    </>
  }

  function handleMobileFiltersOpenChange(open: boolean) {
    if (open) {
      setDraftType(type)
      setDraftFromDate(fromDate)
      setDraftToDate(toDate)
      setDraftCategoryId(categoryId)
    }
    setFiltersOpen(open)
  }

  function closeAddModal() {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('add')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--primary)]">Ledger</p><h2 className="mt-1 text-2xl font-semibold">Transactions</h2></div>
        <Link className="hidden lg:block" to="/transactions?add=1"><Button><Plus className="h-4 w-4" />Add transaction</Button></Link>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1" htmlFor="transaction-search">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--secondary)]" />
            <Input id="transaction-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search description, note, or tag" className="pl-9" />
          </label>
          <MobileFilterSheet open={filtersOpen} onOpenChange={handleMobileFiltersOpenChange} onApply={applyFilters} activeCount={activeFilterCount} iconOnly>
            <div className="space-y-3">
              {renderFilterFields('mobile-transaction')}
              {activeFilterCount > 0 ? <Button type="button" size="sm" variant="ghost" onClick={() => { clearFilters(); setFiltersOpen(false) }}><X className="h-4 w-4" />Clear filters</Button> : null}
            </div>
          </MobileFilterSheet>
        </div>
        <div className="hidden flex-wrap items-end gap-3 sm:flex">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{renderFilterFields('desktop-transaction')}</div>
          <Button type="button" onClick={applyFilters} disabled={!filtersDirty}>Show results</Button>
          {activeFilterCount > 0 || filtersDirty ? <Button type="button" variant="ghost" onClick={clearFilters}><X className="h-4 w-4" />Clear filters</Button> : null}
        </div>
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
          <Card className="divide-y divide-[var(--border)] overflow-visible rounded-xl p-0 shadow-none">
            {items.map((transaction) => (
              <article key={transaction.id} className={`relative ${mobileActionsId === transaction.id ? 'z-30' : ''}`}>
                <div className="flex min-h-[100px] items-start gap-2 px-3 py-3 md:hidden">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${transactionIconBackground(transaction.type)} ${transactionColor(transaction.type)}`}>
                    {isCredit(transaction.type) ? <ArrowDownLeft className="h-5 w-5" /> : transaction.type === 'TRANSFER' ? <ArrowLeftRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewingTransaction(transaction)} aria-label={`View ${transaction.description || transaction.type.toLowerCase().replaceAll('_', ' ')} transaction`}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-[15px] font-semibold leading-5">{transaction.description || transaction.type.replaceAll('_', ' ').toLowerCase()}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--secondary)]">{categoryNames.get(transaction.categoryId) ?? 'Uncategorized'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-[17px] font-semibold ${transactionColor(transaction.type)}`}>{isCredit(transaction.type) ? '+' : transaction.type === 'TRANSFER' ? '' : '−'}<CurrencyAmount amount={transaction.amount} minimumFractionDigits={0} /></p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase text-[var(--secondary)]">{transaction.type.replaceAll('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-t border-[var(--border)] pt-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold uppercase text-[var(--secondary)]">Source</p>
                        <p className="truncate text-xs text-[var(--secondary)]">{formatAccountFlowDetails(transaction, accountNames)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-semibold uppercase text-[var(--secondary)]">Payment mode</p>
                        <p className="text-xs text-[var(--secondary)]">{transaction.paymentMode.replaceAll('_', ' ')}</p>
                      </div>
                    </div>
                  </button>
                  {!campaignLocksTransaction(transaction) && !transaction.savingsGoalId ? <div className="relative shrink-0">
                    <Button variant="ghost" size="icon" className="h-11 w-9" aria-label={`Actions for ${transaction.type.toLowerCase().replaceAll('_', ' ')} transaction`} aria-expanded={mobileActionsId === transaction.id} aria-haspopup="menu" onClick={() => setMobileActionsId((current) => current === transaction.id ? null : transaction.id)}><EllipsisVertical className="h-5 w-5" /></Button>
                    {mobileActionsId === transaction.id ? <div role="menu" className="absolute right-0 top-full z-50 mt-1 flex w-48 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
                      <Button role="menuitem" variant="ghost" className="min-h-11 justify-start" onClick={() => { setEditingTransaction(transaction); setMobileActionsId(null) }}><Pencil className="h-4 w-4" />Edit</Button>
                      <Button role="menuitem" variant="ghost" className="min-h-11 justify-start text-[var(--danger)]" disabled={deleteMutation.isPending} onClick={() => { setTransactionToDelete(transaction); setMobileActionsId(null) }}><Trash2 className="h-4 w-4" />Delete</Button>
                    </div> : null}
                  </div> : null}
                </div>

                <div className="hidden min-h-[88px] items-center gap-4 px-5 py-4 md:flex">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${transactionIconBackground(transaction.type)} ${transactionColor(transaction.type)}`}>
                    {isCredit(transaction.type) ? <ArrowDownLeft className="h-5 w-5" /> : transaction.type === 'TRANSFER' ? <ArrowLeftRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-5 text-left" onClick={() => setViewingTransaction(transaction)} aria-label={`View ${transaction.description || transaction.type.toLowerCase().replaceAll('_', ' ')} transaction`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold">{transaction.description || transaction.type.replaceAll('_', ' ').toLowerCase()}</p>
                      <div className="mt-1 flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm text-[var(--secondary)]">{categoryNames.get(transaction.categoryId) ?? 'Uncategorized'} · {formatAccountFlowDetails(transaction, accountNames)} · {transaction.paymentMode.replaceAll('_', ' ')}</p>
                        <CampaignTransactionBadge transaction={transaction} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xl font-semibold ${transactionColor(transaction.type)}`}>{isCredit(transaction.type) ? '+' : transaction.type === 'TRANSFER' ? '' : '−'}<CurrencyAmount amount={transaction.amount} minimumFractionDigits={0} /></p>
                      <p className="mt-1 text-xs font-semibold uppercase text-[var(--secondary)]">{transaction.type.replaceAll('_', ' ')}</p>
                    </div>
                  </button>
                  {!campaignLocksTransaction(transaction) && !transaction.savingsGoalId ? <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Edit ${transaction.type.toLowerCase().replaceAll('_', ' ')} transaction`} onClick={() => setEditingTransaction(transaction)}><Pencil className="h-5 w-5" /></Button>
                    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Delete ${transaction.type.toLowerCase().replaceAll('_', ' ')} transaction`} disabled={deleteMutation.isPending} onClick={() => setTransactionToDelete(transaction)}><Trash2 className="h-5 w-5 text-[var(--danger)]" /></Button>
                  </div> : null}
                </div>
              </article>
            ))}
          </Card>
        </section>
      ))}
        <PaginationControls page={transactionsQuery.data.page} totalPages={transactionsQuery.data.totalPages} total={transactionsQuery.data.total} limit={transactionsQuery.data.limit} onPageChange={setPage} />
      {transactionToDelete ? (
        <Modal open onClose={() => { if (!deleteMutation.isPending) setTransactionToDelete(null) }} title="Delete transaction?" className="sm:max-w-md">
          <p className="text-sm leading-6 text-[var(--secondary)]">This hides the transaction from active totals and updates linked balances. The transaction is retained in history as a soft-deleted record.</p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => setTransactionToDelete(null)}>Cancel</Button>
            <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(transactionToDelete.id)}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete transaction'}
            </Button>
          </div>
        </Modal>
      ) : null}
      {viewingTransaction ? <Modal open onClose={() => setViewingTransaction(null)} title="Transaction details" className="sm:max-w-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div className="min-w-0"><p className="break-words font-semibold">{viewingTransaction.description || viewingTransaction.type.replaceAll('_', ' ').toLowerCase()}</p><p className="mt-1 text-sm text-[var(--secondary)]">{formatDate(viewingTransaction.transactionDate)}{viewingTransaction.transactionTime ? ` · ${viewingTransaction.transactionTime}` : ''}</p></div>
          <p className={`shrink-0 text-right text-lg font-semibold ${transactionColor(viewingTransaction.type)}`}>{isCredit(viewingTransaction.type) ? '+' : viewingTransaction.type === 'TRANSFER' ? '' : '−'}<CurrencyAmount amount={viewingTransaction.amount} minimumFractionDigits={0} /><span className="mt-1 block text-[10px] font-semibold uppercase text-[var(--secondary)]">{viewingTransaction.type.replaceAll('_', ' ')}</span></p>
        </div>
        <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <div><dt className="text-xs text-[var(--secondary)]">Category</dt><dd className="mt-1 text-sm font-medium">{categoryNames.get(viewingTransaction.categoryId) ?? 'Uncategorized'}</dd></div>
          <div><dt className="text-xs text-[var(--secondary)]">Payment mode</dt><dd className="mt-1 text-sm font-medium">{viewingTransaction.paymentMode.replaceAll('_', ' ')}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-[var(--secondary)]">Account flow</dt><dd className="mt-1 text-sm font-medium">{formatAccountFlowDetails(viewingTransaction, accountNames)}</dd></div>
          {viewingTransaction.note ? <div className="sm:col-span-2"><dt className="text-xs text-[var(--secondary)]">Note</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{viewingTransaction.note}</dd></div> : null}
          {viewingTransaction.tags.length ? <div className="sm:col-span-2"><dt className="text-xs text-[var(--secondary)]">Tags</dt><dd className="mt-1 text-sm">{viewingTransaction.tags.join(', ')}</dd></div> : null}
          {viewingTransaction.plannedExpenseId ? <div className="sm:col-span-2"><dt className="text-xs text-[var(--secondary)]">Linked feature</dt><dd className="mt-1 text-sm">Planned expense campaign</dd></div> : null}
          {viewingTransaction.plannedIncomeId ? <div className="sm:col-span-2"><dt className="text-xs text-[var(--secondary)]">Linked feature</dt><dd className="mt-1 text-sm">Planned income</dd></div> : null}
          {viewingTransaction.savingsGoalId ? <div className="sm:col-span-2"><dt className="text-xs text-[var(--secondary)]">Linked feature</dt><dd className="mt-1 text-sm">Savings goal · {viewingTransaction.savingsMovementDirection?.toLowerCase()}</dd></div> : null}
        </dl>
        <div className="mt-6 flex justify-end gap-2">
          {!campaignLocksTransaction(viewingTransaction) && !viewingTransaction.savingsGoalId && !viewingTransaction.plannedIncomeId ? <Button variant="outline" onClick={() => { setEditingTransaction(viewingTransaction); setViewingTransaction(null) }}><Pencil className="h-4 w-4" />Edit transaction</Button> : null}
          <Button onClick={() => setViewingTransaction(null)}>Close</Button>
        </div>
      </Modal> : null}
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