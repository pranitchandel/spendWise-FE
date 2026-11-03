import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, HandCoins, RotateCcw } from 'lucide-react'
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
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/contexts/ToastContext'
import { todayISO, formatDate } from '@/lib/date'
import type { BorrowingRecord, LendingRecord } from '@/types'
import { useMobileAddForm } from '@/hooks/useMobileAddForm'

const paymentModes = ['UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER', 'NET_BANKING', 'OTHER'] as const
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const recordSchema = z.object({
  personName: z.string().trim().min(1, 'Enter a person’s name'),
  amount: z.number().positive('Amount must be greater than zero'),
  transactionDate: z.string().min(1),
  expectedRepaymentDate: z.string().optional(),
  accountId: z.string().min(1, 'Choose an account'),
  categoryId: z.string().min(1, 'Choose a category'),
  paymentMode: z.enum(paymentModes),
  interestRate: z.number().min(0).optional(),
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

export function LendingBorrowingPage() {
  const mode = useLocation().pathname.startsWith('/borrowing') ? 'BORROWING' : 'LENDING'
  const lending = mode === 'LENDING'
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const addForm = useMobileAddForm()
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null)
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() })
  const categoriesQuery = useQuery({ queryKey: ['categories', mode], queryFn: () => categoriesApi.list({ type: mode }) })
  const lendingQuery = useQuery({ queryKey: ['lending'], queryFn: () => lendingApi.list() })
  const borrowingQuery = useQuery({ queryKey: ['borrowing'], queryFn: () => borrowingApi.list() })
  const recordForm = useForm<RecordForm>({
    resolver: zodResolver(recordSchema),
    defaultValues: { personName: '', amount: undefined, transactionDate: todayISO(), expectedRepaymentDate: '', accountId: '', categoryId: '', paymentMode: 'UPI', interestRate: 0, notes: '' },
  })
  const repaymentForm = useForm<RepaymentForm>({
    resolver: zodResolver(repaymentSchema),
    defaultValues: { amount: undefined, interestAmount: 0, accountId: '', categoryId: '', paymentMode: 'UPI', transactionDate: todayISO(), note: '' },
  })
  const createMutation = useMutation<LendingRecord | BorrowingRecord, Error, RecordForm>({
    mutationFn: (values: RecordForm) => {
      if (lending) {
        const input: LendingInput = { ...values, type: 'LENDING', transactionDate: values.transactionDate, accountId: values.accountId }
        return lendingApi.create(input)
      }
      const input: BorrowingInput = { ...values, type: 'BORROWING', transactionDate: values.transactionDate, accountId: values.accountId }
      return borrowingApi.create(input)
    },
    onSuccess: async () => {
      recordForm.reset({ personName: '', amount: undefined, transactionDate: todayISO(), expectedRepaymentDate: '', accountId: '', categoryId: '', paymentMode: 'UPI', interestRate: 0, notes: '' })
      await queryClient.invalidateQueries()
      addForm.close()
      showToast(lending ? 'Lending record saved.' : 'Borrowing record saved.', 'success')
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

  const loading = accountsQuery.isLoading || categoriesQuery.isLoading || lendingQuery.isLoading || borrowingQuery.isLoading
  if (loading) return <LoadingState label="Loading lending records…" />
  if (accountsQuery.isError || categoriesQuery.isError || lendingQuery.isError || borrowingQuery.isError || !accountsQuery.data || !categoriesQuery.data || !lendingQuery.data || !borrowingQuery.data) {
    return <div role="alert" className="text-sm text-[var(--danger)]">Lending data couldn’t be loaded.</div>
  }

  const records = lending ? lendingQuery.data : borrowingQuery.data
  const totalOutstanding = records.reduce((sum, record) => sum + record.outstanding, 0)
  const selectedRecordInfo = records.find((record) => record.id === selectedRecord)
  const fieldClass = 'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--primary)]">People and repayments</p><h2 className="mt-1 text-2xl font-semibold">Lending &amp; borrowing</h2></div>
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] p-1" role="group" aria-label="Choose lending or borrowing">
          <Link to="/lending" className={`rounded-md px-3 py-2 text-sm font-medium ${lending ? 'bg-[var(--primary)] text-white' : 'text-[var(--secondary)]'}`}>Lending</Link>
          <Link to="/borrowing" className={`rounded-md px-3 py-2 text-sm font-medium ${!lending ? 'bg-[var(--primary)] text-white' : 'text-[var(--secondary)]'}`}>Borrowing</Link>
        </div>
      </div>

      <Card className="flex items-center justify-between gap-4 p-5">
        <div><p className="text-sm text-[var(--secondary)]">{lending ? 'Still owed to you' : 'You still owe'}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{currency.format(totalOutstanding)}</p></div>
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]"><HandCoins className="h-5 w-5" /></div>
      </Card>

      <Modal open={addForm.isOpen} onClose={addForm.close} title={`Record ${lending ? 'money lent' : 'money borrowed'}`} className="sm:max-w-3xl">
        <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={recordForm.handleSubmit((values) => createMutation.mutate(values))} noValidate>
          <label htmlFor="personName" className="space-y-2 text-sm font-medium">{lending ? 'Person' : 'Lender'}<Input id="personName" {...recordForm.register('personName')} error={recordForm.formState.errors.personName?.message} /></label>
          <label htmlFor="record-amount" className="space-y-2 text-sm font-medium">Amount (₹)<Input id="record-amount" type="number" min="0.01" step="0.01" {...recordForm.register('amount', { valueAsNumber: true })} error={recordForm.formState.errors.amount?.message} /></label>
          <label htmlFor="record-date" className="space-y-2 text-sm font-medium">Date<Input id="record-date" type="date" {...recordForm.register('transactionDate')} /></label>
          <label htmlFor="record-account" className="space-y-2 text-sm font-medium">{lending ? 'Source account' : 'Receiving account'}<select id="record-account" className={fieldClass} {...recordForm.register('accountId')}><option value="">Select account</option>{accountsQuery.data.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{recordForm.formState.errors.accountId?.message ? <span className="text-xs text-[var(--danger)]">{recordForm.formState.errors.accountId.message}</span> : null}</label>
          <label htmlFor="record-category" className="space-y-2 text-sm font-medium">Category<select id="record-category" className={fieldClass} {...recordForm.register('categoryId')}><option value="">Select category</option>{categoriesQuery.data.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{recordForm.formState.errors.categoryId?.message ? <span className="text-xs text-[var(--danger)]">{recordForm.formState.errors.categoryId.message}</span> : null}</label>
          <label htmlFor="record-payment" className="space-y-2 text-sm font-medium">Payment mode<select id="record-payment" className={fieldClass} {...recordForm.register('paymentMode')}>{paymentModes.map((payment) => <option key={payment} value={payment}>{payment.replaceAll('_', ' ')}</option>)}</select></label>
          <label htmlFor="expected-date" className="space-y-2 text-sm font-medium">Expected repayment date<Input id="expected-date" type="date" {...recordForm.register('expectedRepaymentDate')} /></label>
          <label htmlFor="interest-rate" className="space-y-2 text-sm font-medium">Interest rate (%)<Input id="interest-rate" type="number" min="0" step="0.01" {...recordForm.register('interestRate', { valueAsNumber: true })} /></label>
          <label htmlFor="record-notes" className="space-y-2 text-sm font-medium">Notes<Input id="record-notes" {...recordForm.register('notes')} /></label>
          <div className="sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving…' : `Save ${lending ? 'lending' : 'borrowing'} record`}</Button></div>
        </form>
      </Modal>

      <section className="space-y-3" aria-label={lending ? 'Lending records' : 'Borrowing records'}>
        <h3 className="font-semibold">{lending ? 'People who owe you' : 'People you owe'}</h3>
        {records.length ? records.map((record) => {
          const person = 'personName' in record ? record.personName : record.lenderName
          const date = 'lendingDate' in record ? record.lendingDate : record.borrowingDate
          return <Card key={record.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${lending ? 'bg-green-50 text-[var(--success)]' : 'bg-amber-50 text-amber-700'}`}>{lending ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div>
              <div className="min-w-0"><p className="truncate font-semibold">{person}</p><p className="mt-1 text-xs text-[var(--secondary)]">{formatDate(date)} · {record.status.replaceAll('_', ' ').toLowerCase()}</p></div>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <div className="text-right"><p className="font-semibold tabular-nums">{currency.format(record.outstanding)}</p><p className="mt-1 text-xs text-[var(--secondary)]">of {currency.format(record.originalAmount)} outstanding</p></div>
              {record.outstanding > 0 ? <Button variant="outline" size="sm" onClick={() => { setSelectedRecord(record.id); repaymentForm.setValue('accountId', ''); repaymentForm.setValue('categoryId', categoriesQuery.data[0]?.id ?? '') }}><RotateCcw className="h-4 w-4" />Repayment</Button> : null}
            </div>
          </Card>
        }) : <Card className="p-8 text-center text-sm text-[var(--secondary)]">No {lending ? 'lending' : 'borrowing'} records yet.</Card>}
      </section>

      {selectedRecord && selectedRecordInfo ? <Modal open onClose={() => setSelectedRecord(null)} title={`Record repayment for ${'personName' in selectedRecordInfo ? selectedRecordInfo.personName : selectedRecordInfo.lenderName}`} className="sm:max-w-3xl">
        <p className="mt-1 text-sm text-[var(--secondary)]">Outstanding: {currency.format(selectedRecordInfo.outstanding)}</p>
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