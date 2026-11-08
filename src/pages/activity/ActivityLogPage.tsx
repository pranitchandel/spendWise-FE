import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Copy, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { accountsApi } from '@/api/accounts'
import { activityLogsApi, type ActivityAction, type ActivityContext, type ActivityLog, type ActivitySource } from '@/api/activityLogs'
import { categoriesApi } from '@/api/categories'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { MobileFilterSheet } from '@/components/ui/MobileFilterSheet'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/date'
import { formatINR } from '@/lib/money'
import type { TransactionType } from '@/types'

const actions: ActivityAction[] = ['CREATED', 'UPDATED', 'DELETED']
const sources: ActivitySource[] = ['MANUAL', 'PLANNED_EXPENSE', 'PLANNED_INCOME', 'SAVINGS', 'LENDING', 'BORROWING', 'REPAYMENT', 'REFUND']
const transactionTypes: TransactionType[] = ['EXPENSE', 'INCOME', 'TRANSFER', 'REFUND', 'LENDING', 'BORROWING', 'LENDING_REPAYMENT', 'BORROWING_REPAYMENT']
const actionTone: Record<ActivityAction, string> = {
  CREATED: 'bg-[var(--success)]/15 text-[var(--success)]',
  UPDATED: 'bg-[var(--primary)]/15 text-[var(--primary)]',
  DELETED: 'bg-[var(--danger)]/15 text-[var(--danger)]',
}
const selectClass = 'h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'

interface Filters {
  action: ActivityAction | ''
  transactionType: TransactionType | ''
  source: ActivitySource | ''
  accountId: string
  from: string
  to: string
}

const emptyFilters: Filters = { action: '', transactionType: '', source: '', accountId: '', from: '', to: '' }
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase()
const display = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value))

function CopyId({ value, label: name }: { value: string; label: string }) {
  const { showToast } = useToast()
  return <button type="button" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--secondary)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]" aria-label={`Copy ${name}`} title={`Copy ${name}`} onClick={() => { void navigator.clipboard.writeText(value).then(() => showToast(`${name} copied.`, 'success'), () => showToast('Copy failed.', 'error')) }}><Copy className="h-3.5 w-3.5" /></button>
}

function relatedRows(context: ActivityContext): Array<[string, string]> {
  const rows: Array<[string, string]> = []
  const { loan, originalExpense, campaign, plannedIncome, savingsGoal } = context
  if (loan) {
    rows.push([`${label(loan.kind)} – ${loan.person}`, `${label(loan.status)}`])
    rows.push(['Original / outstanding', `${formatINR(loan.original)} / ${formatINR(loan.outstanding)}`])
    rows.push(['Principal repaid / interest', `${formatINR(loan.repaid)} / ${formatINR(loan.interest)}`])
  }
  if (originalExpense) {
    rows.push(['Original expense refunded', `${formatINR(originalExpense.refunded)} of ${formatINR(originalExpense.amount)}`])
    rows.push(['Still refundable', formatINR(originalExpense.remainingRefundable)])
  }
  if (campaign) {
    rows.push([`Campaign – ${campaign.name}`, label(campaign.status)])
    rows.push(['Estimated / spent', `${formatINR(campaign.estimated)} / ${formatINR(campaign.spent)}`])
    rows.push(['Remaining', `${formatINR(campaign.remaining)} (${campaign.transactionCount} linked)`])
  }
  if (plannedIncome) {
    rows.push([`Income plan – ${plannedIncome.name}`, label(plannedIncome.status)])
    rows.push(['Recorded', `${plannedIncome.recordedCount} × totalling ${formatINR(plannedIncome.recordedTotal)}`])
  }
  if (savingsGoal) {
    rows.push([`Savings goal – ${savingsGoal.name}`, label(savingsGoal.status)])
    rows.push(['Saved / target', `${formatINR(savingsGoal.saved)} / ${formatINR(savingsGoal.target)}`])
  }
  return rows
}

export function ActivityLogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const transactionId = searchParams.get('transactionId') ?? ''
  const [applied, setApplied] = useState<Filters>(emptyFilters)
  const [draft, setDraft] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const logsQuery = useQuery({
    queryKey: ['activity-logs', applied, transactionId, page],
    queryFn: () => activityLogsApi.listPage({ page, limit: 25, ...applied, transactionId }),
    placeholderData: keepPreviousData,
  })
  const accountsQuery = useQuery({ queryKey: ['accounts', 'all'], queryFn: () => accountsApi.list({ includeArchived: true }) })
  const categoriesQuery = useQuery({ queryKey: ['categories', 'all'], queryFn: () => categoriesApi.list({ includeArchived: true }) })

  if (logsQuery.isLoading || accountsQuery.isLoading || categoriesQuery.isLoading) return <LoadingState label="Loading activity log…" />
  if (logsQuery.isError || accountsQuery.isError || categoriesQuery.isError || !logsQuery.data || !accountsQuery.data || !categoriesQuery.data) {
    return <div role="alert" className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--danger)]">The activity log couldn’t be loaded. Refresh to try again.</div>
  }

  const accountNames = new Map(accountsQuery.data.map((account) => [account.id, account.name]))
  const categoryNames = new Map(categoriesQuery.data.map((category) => [category.id, category.name]))
  const fieldLabels: Record<string, string> = {
    accountId: 'Account', toAccountId: 'To account', categoryId: 'Category', transactionDate: 'Date', transactionTime: 'Time',
    paymentMode: 'Payment mode', interestAmount: 'Interest', description: 'Description', note: 'Note', tags: 'Tags', amount: 'Amount',
  }
  const fieldLabel = (field: string) => fieldLabels[field] ?? field
  function fieldValue(field: string, value: unknown) {
    if (value === null || value === undefined || value === '') return '—'
    if (field === 'accountId' || field === 'toAccountId') return accountNames.get(String(value)) ?? 'Unknown account'
    if (field === 'categoryId') return categoryNames.get(String(value)) ?? 'Unknown category'
    if (field === 'amount' || field === 'interestAmount') return formatINR(Number(value))
    if (field === 'paymentMode') return label(String(value))
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
    return display(value)
  }
  const activeCount = Object.values(applied).filter(Boolean).length
  const dirty = (Object.keys(draft) as Array<keyof Filters>).some((key) => draft[key] !== applied[key])

  function apply() {
    setApplied(draft)
    setPage(1)
  }

  function clear() {
    setDraft(emptyFilters)
    setApplied(emptyFilters)
    setPage(1)
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderFields(idPrefix: string) {
    const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setDraft((current) => ({ ...current, [key]: value }))
    return <>
      <label htmlFor={`${idPrefix}-action`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">Action
        <select id={`${idPrefix}-action`} className={selectClass} value={draft.action} onChange={(event) => set('action', event.target.value as Filters['action'])}>
          <option value="">All actions</option>
          {actions.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-type`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">Transaction type
        <select id={`${idPrefix}-type`} className={selectClass} value={draft.transactionType} onChange={(event) => set('transactionType', event.target.value as Filters['transactionType'])}>
          <option value="">All types</option>
          {transactionTypes.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-source`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">Source
        <select id={`${idPrefix}-source`} className={selectClass} value={draft.source} onChange={(event) => set('source', event.target.value as Filters['source'])}>
          <option value="">All sources</option>
          {sources.map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-account`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">Account
        <select id={`${idPrefix}-account`} className={selectClass} value={draft.accountId} onChange={(event) => set('accountId', event.target.value)}>
          <option value="">All accounts</option>
          {accountsQuery.data?.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-from`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">From date
        <Input id={`${idPrefix}-from`} type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => set('from', event.target.value)} className="h-10" />
      </label>
      <label htmlFor={`${idPrefix}-to`} className="block min-w-0 space-y-1 text-xs font-medium text-[var(--secondary)]">To date
        <Input id={`${idPrefix}-to`} type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => set('to', event.target.value)} className="h-10" />
      </label>
    </>
  }

  function renderLog(log: ActivityLog) {
    const open = expanded.has(log.id)
    const snapshot = log.snapshot as Record<string, unknown>
    return <Card key={log.id} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${actionTone[log.action]}`}>{log.action}</span>
            <span className="text-sm font-semibold capitalize">{label(log.transactionType)}</span>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--secondary)]">
            <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 capitalize">{label(log.source)}</span>
            <span>{formatDate(log.occurredAt, 'DD MMM YYYY, hh:mm:ss A')}</span>
          </p>
        </div>
        <p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{formatINR(log.amount)}</p>
      </div>

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <p className="text-xs font-medium text-[var(--secondary)]">Balance effect</p>
        {log.effects.length ? <ul className="mt-1 space-y-1 sm:max-w-md">
          {log.effects.map((effect) => <li key={effect.accountId} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{accountNames.get(effect.accountId) ?? 'Account'}</span>
            <span className={`whitespace-nowrap font-medium tabular-nums ${effect.delta < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>{effect.delta > 0 ? '+' : '−'}{formatINR(Math.abs(effect.delta))}</span>
          </li>)}
        </ul> : <p className="mt-1 text-sm text-[var(--secondary)]">No account balance change</p>}
      </div>

      {log.context?.accounts.length ? <div className="mt-3 border-t border-[var(--border)] pt-3">
        <p className="text-xs font-medium text-[var(--secondary)]">Account balance after this change</p>
        <ul className="mt-1 space-y-1 sm:max-w-md">
          {log.context.accounts.map((account) => <li key={account.accountId} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{account.name}</span>
            <span className="whitespace-nowrap tabular-nums"><span className="text-[var(--secondary)]">{formatINR(account.balanceBefore)} → </span><span className="font-semibold">{formatINR(account.balanceAfter)}</span></span>
          </li>)}
        </ul>
      </div> : null}

      <button type="button" className="mt-3 flex w-full items-center justify-between text-xs font-medium text-[var(--primary)]" aria-expanded={open} onClick={() => toggle(log.id)}>
        {open ? 'Hide details' : 'View details'}{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? <div className="mt-3 space-y-3 text-xs">
        {log.changes.length ? <div>
          <p className="font-medium text-[var(--secondary)]">Changes</p>
          <ul className="mt-1 divide-y divide-[var(--border)] sm:max-w-md">
            {log.changes.map((change) => <li key={change.field} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
              <span className="font-medium">{fieldLabel(change.field)}</span>
              <span className="text-[var(--secondary)]">{fieldValue(change.field, change.from)} → {fieldValue(change.field, change.to)}</span>
            </li>)}
          </ul>
        </div> : null}
        {log.context && relatedRows(log.context).length ? <div>
          <p className="font-medium text-[var(--secondary)]">Related records after this change</p>
          <dl className="mt-1 grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1 sm:grid-cols-[11rem_1fr]">{relatedRows(log.context).map(([name, value]) => <div key={name} className="contents"><dt className="text-[var(--secondary)]">{name}</dt><dd className="break-words">{value}</dd></div>)}</dl>
        </div> : null}
        <div>
          <p className="font-medium text-[var(--secondary)]">{log.action === 'DELETED' ? 'Transaction before delete' : 'Transaction after change'}</p>
          <dl className="mt-1 grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1 sm:grid-cols-[11rem_1fr]">
            {([
              ['Date', snapshot.transactionDate ? `${formatDate(String(snapshot.transactionDate))}${snapshot.transactionTime ? `, ${snapshot.transactionTime}` : ''}` : ''],
              ['Account', fieldValue('accountId', snapshot.accountId)],
              ['To account', snapshot.toAccountId ? fieldValue('toAccountId', snapshot.toAccountId) : ''],
              ['Category', snapshot.categoryId ? fieldValue('categoryId', snapshot.categoryId) : ''],
              ['Payment mode', fieldValue('paymentMode', snapshot.paymentMode)],
              ['Interest', Number(snapshot.interestAmount) > 0 ? fieldValue('interestAmount', snapshot.interestAmount) : ''],
              ['Savings movement', snapshot.savingsMovementDirection ? label(String(snapshot.savingsMovementDirection)) : ''],
              ['Description', snapshot.description ? String(snapshot.description) : ''],
              ['Note', snapshot.note ? String(snapshot.note) : ''],
              ['Tags', Array.isArray(snapshot.tags) && snapshot.tags.length ? snapshot.tags.join(', ') : ''],
            ] as Array<[string, string]>).filter(([, value]) => value && value !== '—').map(([name, value]) => <div key={name} className="contents">
              <dt className="text-[var(--secondary)]">{name}</dt>
              <dd className="break-words">{value}</dd>
            </div>)}
          </dl>
        </div>
        <div>
          <p className="font-medium text-[var(--secondary)]">IDs</p>
          <ul className="mt-1 divide-y divide-[var(--border)] sm:max-w-md">
            {([
              ['Transaction ID', log.transactionId],
              ['Linked transaction ID', snapshot.linkedTransactionId],
              [`${label(String(snapshot.linkedRecordType ?? 'loan'))} record ID`, snapshot.linkedRecordId],
              ['Campaign ID', snapshot.plannedExpenseId],
              ['Income plan ID', snapshot.plannedIncomeId],
              ['Savings goal ID', snapshot.savingsGoalId],
              ['Log entry ID', log.id],
            ] as Array<[string, unknown]>).filter(([, value]) => value).map(([name, value]) => <li key={name} className="flex items-center justify-between gap-2 py-1">
              <span className="min-w-0"><span className="block text-[var(--secondary)]">{name}</span><span className="block break-all font-mono text-[11px]">{String(value)}</span></span>
              <CopyId value={String(value)} label={name} />
            </li>)}
          </ul>
        </div>
        {!transactionId ? <Button type="button" size="sm" variant="outline" onClick={() => { setSearchParams({ transactionId: log.transactionId }); setPage(1) }}>View history for this transaction</Button> : null}
      </div> : null}
    </Card>
  }

  return <div className="space-y-6">
    <div>
      <p className="text-sm font-medium text-[var(--primary)]">Ledger audit</p>
      <h2 className="mt-1 text-2xl font-semibold">Activity log</h2>
      <p className="mt-1 text-sm text-[var(--secondary)]">Every transaction create, edit and delete, with the account balance change each one caused. Use it to trace balance discrepancies.</p>
    </div>

    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2 sm:hidden">
        <MobileFilterSheet open={filtersOpen} onOpenChange={(open) => { if (open) setDraft(applied); setFiltersOpen(open) }} onApply={apply} activeCount={activeCount}>
          <div className="space-y-3">
            {renderFields('mobile-activity')}
            {activeCount > 0 ? <Button type="button" size="sm" variant="ghost" onClick={() => { clear(); setFiltersOpen(false) }}><X className="h-4 w-4" />Clear filters</Button> : null}
          </div>
        </MobileFilterSheet>
      </div>
      <div className="hidden flex-wrap items-end gap-3 sm:flex">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{renderFields('desktop-activity')}</div>
        <Button type="button" onClick={apply} disabled={!dirty}>Show results</Button>
        {activeCount > 0 || dirty ? <Button type="button" variant="ghost" onClick={clear}><X className="h-4 w-4" />Clear filters</Button> : null}
      </div>
      {transactionId ? <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--muted)] p-3 text-sm">
        <div className="min-w-0">
          <p className="text-xs text-[var(--secondary)]">Showing one transaction</p>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-xs"><span className="truncate">{transactionId}</span><CopyId value={transactionId} label="Transaction ID" /></p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => { setSearchParams({}); setPage(1) }}><X className="h-4 w-4" />Show all</Button>
      </div> : null}
    </div>

    {logsQuery.data.items.length ? <div className="max-w-3xl space-y-3">{logsQuery.data.items.map(renderLog)}</div> : <Card className="p-8 text-center text-sm text-[var(--secondary)]">No activity matches these filters.</Card>}
    <PaginationControls page={logsQuery.data.page} totalPages={logsQuery.data.totalPages} total={logsQuery.data.total} limit={logsQuery.data.limit} onPageChange={setPage} />
  </div>
}
