import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, EllipsisVertical, HandCoins, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { accountsApi } from '@/api/accounts'
import { borrowingApi, type BorrowingInput } from '@/api/borrowing'
import { getErrorMessage } from '@/api/client'
import { categoriesApi } from '@/api/categories'
import { lendingApi, type LendingInput, type RepaymentInput } from '@/api/lending'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CurrencyAmount } from '@/components/ui/CurrencyAmount'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { useToast } from '@/contexts/ToastContext'
import { todayISO, formatDate } from '@/lib/date'
import type { BorrowingRecord, LendingRecord, LendingStatus, Repayment } from '@/types'
import { useMobileAddForm } from '@/hooks/useMobileAddForm'

const paymentModes = ['UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'NET_BANKING', 'OTHER'] as const
const recordSchema = z.object({
  personName: z.string().trim().min(1, 'Enter a person’s name'),
  phone: z.string().max(40).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  amount: z.number().positive('Amount must be greater than zero'),
  transactionDate: z.string().min(1),
  expectedRepaymentDate: z.string().optional(),
  accountId: z.string().min(1, 'Choose an account'),
  categoryId: z.string().min(1, 'Choose a category'),
  paymentMode: z.enum(paymentModes),
  interestRate: z.number().min(0).optional(),
  description: z.string().max(500).optional(),
  repaymentTerms: z.string().max(2000).optional(),
  notes: z.string().optional(),
})
const repaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  interestAmount: z.number().min(0).optional(),
  accountId: z.string().min(1, 'Choose an account'),
  categoryId: z.string().min(1, 'Choose a category'),
  paymentMode: z.enum(paymentModes),
  transactionDate: z.string().min(1),
  note: z.string().optional(),
})
type RecordForm = z.infer<typeof recordSchema>
type RepaymentForm = z.infer<typeof repaymentSchema>
type DebtRecord = LendingRecord | BorrowingRecord
type DebtRecordDetails = (LendingRecord | BorrowingRecord) & { repayments?: Repayment[] }
type StatusFilter = 'ALL' | LendingStatus

const lendingStatuses: LendingStatus[] = ['ACTIVE', 'PARTIALLY_REPAID', 'OVERDUE', 'REPAID', 'WRITTEN_OFF']

export function LendingBorrowingPage() {
  const mode = useLocation().pathname.startsWith('/borrowing') ? 'BORROWING' : 'LENDING'
  const lending = mode === 'LENDING'
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const addForm = useMobileAddForm()
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState<DebtRecord | null>(null)
  const [recordToDelete, setRecordToDelete] = useState<DebtRecord | null>(null)
  const [recordActionsId, setRecordActionsId] = useState<string | null>(null)
  const [historyRecordId, setHistoryRecordId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const categoriesQuery = useQuery({ queryKey: ['categories', mode], queryFn: () => categoriesApi.list({ type: mode }) })
  const lendingQuery = useQuery({ queryKey: ['lending', statusFilter, search, page], queryFn: () => lendingApi.listPage({ status: statusFilter || undefined, search: search.trim() || undefined, page, limit: 20 }), placeholderData: (previous) => previous })
  const borrowingQuery = useQuery({ queryKey: ['borrowing', statusFilter, search, page], queryFn: () => borrowingApi.listPage({ status: statusFilter || undefined, search: search.trim() || undefined, page, limit: 20 }), placeholderData: (previous) => previous })
  const repaymentHistoryQuery = useQuery<DebtRecordDetails>({
    queryKey: ['lending-record-detail', mode, historyRecordId],
    queryFn: () => lending
      ? lendingApi.get(historyRecordId!)
      : borrowingApi.get(historyRecordId!),
    enabled: Boolean(historyRecordId),
  })
  const recordForm = useForm<RecordForm>({
    resolver: zodResolver(recordSchema),
    defaultValues: { personName: '', phone: '', email: '', amount: undefined, transactionDate: todayISO(), expectedRepaymentDate: '', accountId: '', categoryId: '', paymentMode: 'UPI', interestRate: 0, description: '', repaymentTerms: '', notes: '' },
  })
  const repaymentForm = useForm<RepaymentForm>({
    resolver: zodResolver(repaymentSchema),
    defaultValues: { amount: undefined, interestAmount: 0, accountId: '', categoryId: '', paymentMode: 'UPI', transactionDate: todayISO(), note: '' },
  })
  const createMutation = useMutation<LendingRecord | BorrowingRecord, Error, RecordForm>({
    mutationFn: (values: RecordForm) => {
      if (lending) {
        const input: LendingInput = { ...values, type: 'LENDING', transactionDate: values.transactionDate, accountId: values.accountId }
        return editingRecord ? lendingApi.update(editingRecord.id, input) : lendingApi.create(input)
      }
      const input: BorrowingInput = { ...values, type: 'BORROWING', transactionDate: values.transactionDate, accountId: values.accountId }
      return editingRecord ? borrowingApi.update(editingRecord.id, input) : borrowingApi.create(input)
    },
    onSuccess: async () => {
      const wasEditing = Boolean(editingRecord)
      setEditingRecord(null)
      recordForm.reset({ personName: '', phone: '', email: '', amount: undefined, transactionDate: todayISO(), expectedRepaymentDate: '', accountId: '', categoryId: '', paymentMode: 'UPI', interestRate: 0, description: '', repaymentTerms: '', notes: '' })
      await queryClient.invalidateQueries()
      addForm.close()
      showToast(wasEditing ? 'Record updated.' : lending ? 'Lending record saved.' : 'Borrowing record saved.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const repayMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: RepaymentForm }) => {
      const input: RepaymentInput = values
      return lending ? lendingApi.addRepayment(id, input) : borrowingApi.addRepayment(id, input)
    },
    onSuccess: async () => {
      setSelectedRecord(null)
      repaymentForm.reset({ amount: undefined, interestAmount: 0, accountId: '', categoryId: '', paymentMode: 'UPI', transactionDate: todayISO(), note: '' })
      await queryClient.invalidateQueries()
      showToast('Repayment saved.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const deleteRecordMutation = useMutation({
    mutationFn: (record: DebtRecord) => lending
      ? lendingApi.remove(record.id)
      : borrowingApi.remove(record.id),
    onSuccess: async () => {
      setRecordToDelete(null)
      await queryClient.invalidateQueries()
      showToast(`${lending ? 'Lending' : 'Borrowing'} record deleted.`, 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })

  const loading = accountsQuery.isLoading || categoriesQuery.isLoading || lendingQuery.isLoading || borrowingQuery.isLoading
  if (loading) return <LoadingState label="Loading lending records…" />
  if (accountsQuery.isError || categoriesQuery.isError || lendingQuery.isError || borrowingQuery.isError || !accountsQuery.data || !categoriesQuery.data || !lendingQuery.data || !borrowingQuery.data) {
    return <div role="alert" className="text-sm text-[var(--danger)]">Lending data couldn’t be loaded.</div>
  }

  const recordPage = lending ? lendingQuery.data : borrowingQuery.data
  const records = recordPage?.items ?? []
  const totalOutstanding = recordPage?.totalOutstanding ?? 0
  const filteredOutstanding = totalOutstanding
  const selectedRecordInfo = records.find((record) => record.id === selectedRecord)
  const fieldClass = 'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'
  function closeRecordForm() {
    setEditingRecord(null)
    addForm.close()
    recordForm.reset({ personName: '', phone: '', email: '', amount: undefined, transactionDate: todayISO(), expectedRepaymentDate: '', accountId: '', categoryId: '', paymentMode: 'UPI', interestRate: 0, description: '', repaymentTerms: '', notes: '' })
  }

  async function editRecord(record: DebtRecord) {
    try {
      const details = lending ? await lendingApi.get(record.id) : await borrowingApi.get(record.id)
      const personName = 'personName' in details ? details.personName : details.lenderName
      const transactionDate = 'lendingDate' in details ? details.lendingDate : details.borrowingDate
      const accountId = 'sourceAccountId' in details ? details.sourceAccountId : details.receivingAccountId
      recordForm.reset({
        personName,
        phone: details.phone,
        email: details.email,
        amount: details.originalAmount,
        transactionDate,
        expectedRepaymentDate: details.expectedRepaymentDate ?? '',
        accountId,
        categoryId: details.categoryId || categoriesQuery.data?.[0]?.id || '',
        paymentMode: details.paymentMode,
        interestRate: details.interestRate ?? 0,
        description: 'description' in details ? details.description : '',
        repaymentTerms: 'repaymentTerms' in details ? details.repaymentTerms : '',
        notes: details.notes,
      })
      addForm.close()
      setEditingRecord(record)
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
    }
  }

  function hasRepaymentHistory(record: DebtRecord) {
    return record.totalRepaid > 0 || ('totalInterestReceived' in record
      ? record.totalInterestReceived > 0
      : record.totalInterestPaid > 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--primary)]">People and repayments</p><h2 className="mt-1 text-2xl font-semibold">Lending &amp; borrowing</h2></div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] p-1" role="group" aria-label="Choose lending or borrowing">
              <Link to="/lending" className={`rounded-md px-3 py-2 text-sm font-medium ${lending ? 'bg-[var(--primary)] text-white' : 'text-[var(--secondary)]'}`}>Lending</Link>
              <Link to="/borrowing" className={`rounded-md px-3 py-2 text-sm font-medium ${!lending ? 'bg-[var(--primary)] text-white' : 'text-[var(--secondary)]'}`}>Borrowing</Link>
            </div>
            <Link className="hidden lg:block" to={`${lending ? '/lending' : '/borrowing'}?add=1`}><Button><Plus className="h-4 w-4" />Add record</Button></Link>
          </div>
      </div>

      <Card className="flex items-center justify-between gap-4 p-5">
        <div><p className="text-sm text-[var(--secondary)]">{lending ? 'Still owed to you' : 'You still owe'}</p><p className="mt-1 text-2xl font-semibold"><CurrencyAmount amount={totalOutstanding} minimumFractionDigits={0} /></p></div>
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]"><HandCoins className="h-5 w-5" /></div>
      </Card>

      <div className="space-y-3">
        <label className="relative block min-w-0" htmlFor="lending-record-search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--secondary)]" />
          <Input id="lending-record-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search people, contact, notes, or amount" className="pl-9" />
        </label>
        <label htmlFor="lending-status-filter" className="sr-only">Filter by repayment status</label>
        <select id="lending-status-filter" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setPage(1) }} className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] sm:w-auto">
          <option value="ALL">All statuses</option>
          {lendingStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ').toLowerCase()}</option>)}
        </select>
      </div>

      <Modal open={addForm.isOpen || !!editingRecord} onClose={closeRecordForm} title={editingRecord ? `Edit ${lending ? 'lending' : 'borrowing'} record` : `Record ${lending ? 'money lent' : 'money borrowed'}`} className="sm:max-w-3xl">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={recordForm.handleSubmit((values) => createMutation.mutate(values))} noValidate>
          <label htmlFor="personName" className="space-y-2 text-sm font-medium">{lending ? 'Person' : 'Lender'}<Input id="personName" {...recordForm.register('personName')} error={recordForm.formState.errors.personName?.message} /></label>
          <label htmlFor="record-phone" className="space-y-2 text-sm font-medium">Phone (optional)<Input id="record-phone" {...recordForm.register('phone')} /></label>
          <label htmlFor="record-email" className="space-y-2 text-sm font-medium">Email (optional)<Input id="record-email" type="email" {...recordForm.register('email')} error={recordForm.formState.errors.email?.message} /></label>
          <label htmlFor="record-amount" className="space-y-2 text-sm font-medium">Amount (₹)<Input id="record-amount" type="number" min="0.01" step="0.01" {...recordForm.register('amount', { valueAsNumber: true })} error={recordForm.formState.errors.amount?.message} /></label>
          <label htmlFor="record-date" className="space-y-2 text-sm font-medium">Date<Input id="record-date" type="date" {...recordForm.register('transactionDate')} /></label>
          <label htmlFor="record-account" className="space-y-2 text-sm font-medium">{lending ? 'Source account' : 'Receiving account'}<select id="record-account" className={fieldClass} {...recordForm.register('accountId')}><option value="">Select account</option>{accountsQuery.data.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{recordForm.formState.errors.accountId?.message ? <span className="text-xs text-[var(--danger)]">{recordForm.formState.errors.accountId.message}</span> : null}</label>
          <label htmlFor="record-category" className="space-y-2 text-sm font-medium">Category<select id="record-category" className={fieldClass} {...recordForm.register('categoryId')}><option value="">Select category</option>{categoriesQuery.data.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{recordForm.formState.errors.categoryId?.message ? <span className="text-xs text-[var(--danger)]">{recordForm.formState.errors.categoryId.message}</span> : null}</label>
          <label htmlFor="record-payment" className="space-y-2 text-sm font-medium">Payment mode<select id="record-payment" className={fieldClass} {...recordForm.register('paymentMode')}>{paymentModes.map((payment) => <option key={payment} value={payment}>{payment.replaceAll('_', ' ')}</option>)}</select></label>
          <label htmlFor="expected-date" className="space-y-2 text-sm font-medium">Expected repayment date<Input id="expected-date" type="date" {...recordForm.register('expectedRepaymentDate')} /></label>
          <label htmlFor="interest-rate" className="space-y-2 text-sm font-medium">Interest rate (%)<Input id="interest-rate" type="number" min="0" step="0.01" {...recordForm.register('interestRate', { valueAsNumber: true })} /></label>
          {lending ? <label htmlFor="record-description" className="space-y-2 text-sm font-medium">Description (optional)<Input id="record-description" {...recordForm.register('description')} /></label> : <label htmlFor="repayment-terms" className="space-y-2 text-sm font-medium">Repayment terms (optional)<Input id="repayment-terms" {...recordForm.register('repaymentTerms')} /></label>}
          <label htmlFor="record-notes" className="space-y-2 text-sm font-medium">Notes<Input id="record-notes" {...recordForm.register('notes')} /></label>
          <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-3">{editingRecord ? <Button type="button" variant="outline" onClick={closeRecordForm}>Cancel</Button> : null}<Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving…' : editingRecord ? 'Save changes' : `Save ${lending ? 'lending' : 'borrowing'} record`}</Button></div>
        </form>
      </Modal>

      <section className="space-y-3" aria-label={lending ? 'Lending records' : 'Borrowing records'}>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-semibold">{lending ? 'People who owe you' : 'People you owe'}</h3>
            <span className="text-sm font-semibold"><CurrencyAmount amount={filteredOutstanding} minimumFractionDigits={0} /> <span className="text-xs font-normal text-[var(--secondary)]">outstanding</span></span>
          </div>
          <span className="text-right text-xs text-[var(--secondary)]">{recordPage?.total ?? 0} records</span>
        </div>
        {records.length ? records.map((record) => {
          const person = 'personName' in record ? record.personName : record.lenderName
          const date = 'lendingDate' in record ? record.lendingDate : record.borrowingDate
          return <Card key={record.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${lending ? 'bg-green-50 text-[var(--success)]' : 'bg-amber-50 text-amber-700'}`}>{lending ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div>
              <div className="min-w-0"><p className="truncate font-semibold">{person}</p><p className="mt-1 text-xs text-[var(--secondary)]">{formatDate(date)} · {record.status.replaceAll('_', ' ').toLowerCase()}</p></div>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <div className="text-right"><p className="font-semibold"><CurrencyAmount amount={record.outstanding} minimumFractionDigits={0} /></p><p className="mt-1 text-xs text-[var(--secondary)]">of <CurrencyAmount amount={record.originalAmount} minimumFractionDigits={0} /> outstanding</p></div>
              <div className="inline-flex shrink-0 items-center rounded-lg border border-[var(--border)] bg-[var(--card)]">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 rounded-none ${hasRepaymentHistory(record) ? 'border-r border-[var(--border)]' : ''}`}
                  aria-label={`Add repayment for ${person}`}
                  title={record.outstanding <= 0 ? 'No outstanding balance remains' : 'Add repayment'}
                  disabled={record.outstanding <= 0}
                  onClick={() => {
                    setSelectedRecord(record.id)
                    repaymentForm.reset({ amount: undefined, interestAmount: 0, accountId: '', categoryId: categoriesQuery.data[0]?.id ?? '', paymentMode: 'UPI', transactionDate: todayISO(), note: '' })
                  }}
                >
                  <Plus className="h-5 w-5" />
                </Button>
                {hasRepaymentHistory(record) ? <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-none border-r border-[var(--border)]"
                  aria-label={historyRecordId === record.id ? `Hide repayments for ${person}` : `View repayments for ${person}`}
                  title={historyRecordId === record.id ? 'Hide repayment history' : 'View repayment history'}
                  aria-expanded={historyRecordId === record.id}
                  onClick={() => setHistoryRecordId((current) => current === record.id ? null : record.id)}
                >
                  {historyRecordId === record.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button> : null}
              <div className="relative">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-none"
                  aria-label={`Actions for ${person}'s ${lending ? 'lending' : 'borrowing'} record`}
                  aria-expanded={recordActionsId === record.id}
                  aria-haspopup="menu"
                  onClick={() => setRecordActionsId((current) => current === record.id ? null : record.id)}
                >
                  <EllipsisVertical className="h-5 w-5" />
                </Button>
                {recordActionsId === record.id ? <div role="menu" className="absolute right-0 top-full z-30 mt-1 flex w-44 flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
                  <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3" disabled={hasRepaymentHistory(record)} title={hasRepaymentHistory(record) ? 'Records with repayments cannot be edited' : undefined} onClick={() => { setRecordActionsId(null); void editRecord(record) }}><Pencil className="h-4 w-4" />Edit record</Button>
                  <Button role="menuitem" variant="ghost" className="min-h-11 w-full justify-start gap-3 text-[var(--danger)]" disabled={hasRepaymentHistory(record)} title={hasRepaymentHistory(record) ? 'Records with repayments cannot be deleted' : undefined} onClick={() => { setRecordActionsId(null); setRecordToDelete(record) }}><Trash2 className="h-4 w-4" />Delete record</Button>
                </div> : null}
              </div>
              </div>
            </div>
            {historyRecordId === record.id ? <div className="-mx-5 -mb-5 mt-1 w-full border-t border-[var(--border)] px-5 py-4 sm:basis-full">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Repayment history</h4>
                {repaymentHistoryQuery.data ? <span className="text-xs text-[var(--secondary)]">{repaymentHistoryQuery.data.repayments?.length ?? 0} payments</span> : null}
              </div>
              {repaymentHistoryQuery.isLoading ? <p className="text-sm text-[var(--secondary)]">Loading repayment history…</p> : null}
              {repaymentHistoryQuery.isError ? <p role="alert" className="text-sm text-[var(--danger)]">Repayment history couldn’t be loaded.</p> : null}
              {repaymentHistoryQuery.data && repaymentHistoryQuery.data.repayments?.length ? <ul className="divide-y divide-[var(--border)]">
                {repaymentHistoryQuery.data.repayments.map((repayment) => <li key={repayment.id} className="space-y-1.5 py-3 text-sm">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="shrink-0 whitespace-nowrap text-xs font-medium sm:text-sm">{formatDate(repayment.repaymentDate)}</p>
                    <p className="shrink-0 whitespace-nowrap text-right font-semibold"><CurrencyAmount amount={repayment.amount} minimumFractionDigits={0} /> <span className="text-[10px] font-normal text-[var(--secondary)] sm:text-xs">principal</span></p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[var(--secondary)]">
                    <span className="min-w-0 truncate">{repayment.accountId ? accountsQuery.data.find((account) => account.id === repayment.accountId)?.name ?? 'Account' : 'Account'}</span>
                    {repayment.interest > 0 ? <span className="shrink-0 whitespace-nowrap">+ <CurrencyAmount amount={repayment.interest} minimumFractionDigits={0} /> interest</span> : null}
                  </div>
                  {repayment.notes ? <p className="truncate text-xs text-[var(--secondary)]">{repayment.notes}</p> : null}
                </li>)}
              </ul> : null}
              {repaymentHistoryQuery.data && !repaymentHistoryQuery.data.repayments?.length ? <p className="text-sm text-[var(--secondary)]">No repayments recorded yet.</p> : null}
            </div> : null}
          </Card>
        }) : <Card className="p-8 text-center text-sm text-[var(--secondary)]">{search || statusFilter !== 'ALL' ? 'No records match your search and status filter.' : `No ${lending ? 'lending' : 'borrowing'} records yet.`}</Card>}
      </section>
      {recordPage ? <PaginationControls page={recordPage.page} totalPages={recordPage.totalPages} total={recordPage.total} limit={recordPage.limit} onPageChange={setPage} /> : null}

      {recordToDelete ? <Modal open onClose={() => { if (!deleteRecordMutation.isPending) setRecordToDelete(null) }} title={`Delete ${lending ? 'lending' : 'borrowing'} record?`} className="sm:max-w-md">
        <p className="text-sm leading-6 text-[var(--secondary)]">Delete the record for <span className="font-semibold text-[var(--foreground)]">{'personName' in recordToDelete ? recordToDelete.personName : recordToDelete.lenderName}</span>? This also removes its linked original transaction. Records with repayment history must be kept to preserve the ledger.</p>
        <div className="mt-6 flex justify-end gap-3"><Button variant="outline" disabled={deleteRecordMutation.isPending} onClick={() => setRecordToDelete(null)}>Keep record</Button><Button variant="danger" disabled={deleteRecordMutation.isPending || hasRepaymentHistory(recordToDelete)} onClick={() => deleteRecordMutation.mutate(recordToDelete)}>{deleteRecordMutation.isPending ? 'Deleting…' : 'Delete record'}</Button></div>
      </Modal> : null}

      {selectedRecord && selectedRecordInfo ? <Modal open onClose={() => setSelectedRecord(null)} title={`Record repayment for ${'personName' in selectedRecordInfo ? selectedRecordInfo.personName : selectedRecordInfo.lenderName}`} className="sm:max-w-3xl">
        <p className="mt-1 text-sm text-[var(--secondary)]">Outstanding: <CurrencyAmount amount={selectedRecordInfo.outstanding} minimumFractionDigits={0} /></p>
        <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={repaymentForm.handleSubmit((values) => repayMutation.mutate({ id: selectedRecord, values }))} noValidate>
          <label htmlFor="repayment-amount" className="space-y-2 text-sm font-medium">Amount (₹)<Input id="repayment-amount" type="number" min="0.01" step="0.01" {...repaymentForm.register('amount', { valueAsNumber: true })} error={repaymentForm.formState.errors.amount?.message} /></label>
          <label htmlFor="repayment-interest" className="space-y-2 text-sm font-medium">Interest amount (₹)<Input id="repayment-interest" type="number" min="0" step="0.01" {...repaymentForm.register('interestAmount', { valueAsNumber: true })} /></label>
          <label htmlFor="repayment-date" className="space-y-2 text-sm font-medium">Date<Input id="repayment-date" type="date" {...repaymentForm.register('transactionDate')} /></label>
          <label htmlFor="repayment-account" className="space-y-2 text-sm font-medium">Account<select id="repayment-account" className={fieldClass} {...repaymentForm.register('accountId')}><option value="">Select account</option>{accountsQuery.data.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label htmlFor="repayment-category" className="space-y-2 text-sm font-medium">Category<select id="repayment-category" className={fieldClass} {...repaymentForm.register('categoryId')}><option value="">Select category</option>{categoriesQuery.data.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label htmlFor="repayment-mode" className="space-y-2 text-sm font-medium">Payment mode<select id="repayment-mode" className={fieldClass} {...repaymentForm.register('paymentMode')}>{paymentModes.map((payment) => <option key={payment} value={payment}>{payment.replaceAll('_', ' ')}</option>)}</select></label>
          <label htmlFor="repayment-note" className="space-y-2 text-sm font-medium sm:col-span-2">Note<Input id="repayment-note" {...repaymentForm.register('note')} /></label>
          <div className="flex items-end gap-3"><Button type="button" variant="outline" onClick={() => setSelectedRecord(null)}>Cancel</Button><Button type="submit" disabled={repayMutation.isPending}>{repayMutation.isPending ? 'Saving…' : 'Save repayment'}</Button></div>
        </form>
      </Modal> : null}
    </div>
  )
}