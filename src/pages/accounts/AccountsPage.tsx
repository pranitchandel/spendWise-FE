import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Landmark, Pencil, Plus, RotateCcw, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { accountsApi, type AccountInput } from '@/api/accounts'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CurrencyAmount } from '@/components/ui/CurrencyAmount'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { MobileFilterSheet } from '@/components/ui/MobileFilterSheet'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { todayISO } from '@/lib/date'
import { useMobileAddForm } from '@/hooks/useMobileAddForm'
import { useToast } from '@/contexts/ToastContext'

const accountTypes = ['SAVINGS', 'CURRENT', 'CASH', 'CREDIT_CARD', 'OTHER'] as const
const accountSchema = z.object({
  name: z.string().trim().min(1, 'Enter an account name'),
  type: z.enum(accountTypes),
  institutionName: z.string().optional(),
  maskedIdentifier: z.string().max(8, 'Use up to 8 characters').optional(),
  openingBalance: z.number(),
  openingBalanceDate: z.string().min(1, 'Choose an opening date'),
})
type AccountForm = z.infer<typeof accountSchema>
function emptyAccountForm(): AccountForm {
  return { name: '', type: 'SAVINGS', institutionName: '', maskedIdentifier: '', openingBalance: 0, openingBalanceDate: todayISO() }
}

export function AccountsPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const addForm = useMobileAddForm()
  const [includeArchived, setIncludeArchived] = useState(false)
  const [draftIncludeArchived, setDraftIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Awaited<ReturnType<typeof accountsApi.get>> | null>(null)
  const accountsQuery = useQuery({
    queryKey: ['accounts', includeArchived, page],
    queryFn: () => accountsApi.listPage({ includeArchived, page, limit: 20 }),
    placeholderData: (previous) => previous,
  })
  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: emptyAccountForm(),
  })

  useEffect(() => {
    if (!addForm.isOpen) return
    form.reset(emptyAccountForm())
  }, [addForm.isOpen, form])

  const saveMutation = useMutation({
    mutationFn: (input: AccountInput) => editingAccount
      ? accountsApi.update(editingAccount.id, input)
      : accountsApi.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      form.reset(emptyAccountForm())
      showToast(editingAccount ? 'Account updated.' : 'Account added.', 'success')
      addForm.close()
      setEditingAccount(null)
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const archiveMutation = useMutation({
    mutationFn: (account: Awaited<ReturnType<typeof accountsApi.get>>) => accountsApi.remove(account.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      showToast('Account archived.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  if (accountsQuery.isLoading) return <LoadingState label="Loading accounts…" />
  if (accountsQuery.isError || !accountsQuery.data) return <div role="alert" className="text-sm text-[var(--danger)]">Accounts couldn’t be loaded.</div>

  function submit(values: AccountForm) {
    saveMutation.mutate({ ...values, openingBalance: values.openingBalance ?? 0 })
  }

  function editAccount(account: Awaited<ReturnType<typeof accountsApi.get>>) {
    setEditingAccount(account)
    form.reset({
      name: account.name,
      type: account.type,
      institutionName: account.institutionName,
      maskedIdentifier: account.maskedIdentifier,
      openingBalance: account.openingBalance,
      openingBalanceDate: account.openingBalanceDate,
    })
  }

  function openAddForm() {
    setEditingAccount(null)
    form.reset(emptyAccountForm())
  }

  function closeForm() {
    addForm.close()
    setEditingAccount(null)
    form.reset(emptyAccountForm())
  }

  const fieldClass = 'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[var(--primary)]">Your money</p><h2 className="mt-1 text-2xl font-semibold">Accounts</h2></div>
        <Link className="hidden lg:block" to="/accounts?add=1" onClick={openAddForm}><Button><Plus className="h-4 w-4" />Add account</Button></Link>
      </div>
      <div className="hidden items-center gap-3 sm:flex">
        <label className="flex items-center gap-2 text-sm text-[var(--secondary)]">
          <input type="checkbox" checked={draftIncludeArchived} onChange={(event) => setDraftIncludeArchived(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Show archived accounts
        </label>
        <Button type="button" size="sm" disabled={draftIncludeArchived === includeArchived} onClick={() => { setIncludeArchived(draftIncludeArchived); setPage(1) }}>Show results</Button>
      </div>
      <MobileFilterSheet open={filtersOpen} onOpenChange={(open) => { if (open) setDraftIncludeArchived(includeArchived); setFiltersOpen(open) }} onApply={() => { setIncludeArchived(draftIncludeArchived); setPage(1) }} activeCount={Number(includeArchived)}>
        <label className="flex items-center gap-2 text-sm text-[var(--secondary)]">
          <input type="checkbox" checked={draftIncludeArchived} onChange={(event) => setDraftIncludeArchived(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Show archived accounts
        </label>
      </MobileFilterSheet>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Accounts and current balances">
        {accountsQuery.data.items.map((account) => (
          <Card key={account.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]">{account.type === 'CASH' ? <WalletCards className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}</div>
                <div className="min-w-0"><p className="truncate font-semibold">{account.name}</p><p className="mt-1 truncate text-xs text-[var(--secondary)]">{account.institutionName || account.type.replaceAll('_', ' ')}</p></div>
              </div>
              <span className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase ${account.isActive ? 'bg-green-50 text-green-700' : 'bg-[var(--muted)] text-[var(--secondary)]'}`}>{account.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <p className="mt-6 text-2xl font-semibold"><CurrencyAmount amount={account.balance ?? account.openingBalance} minimumFractionDigits={0} /></p>
            <p className="mt-1 text-xs text-[var(--secondary)]">Current balance</p>
            <div className="mt-4 flex gap-2 border-t border-[var(--border)] pt-3">
              <Button size="sm" variant="outline" onClick={() => editAccount(account)}><Pencil className="h-4 w-4" />Edit</Button>
              {account.isArchived ? (
                <Button size="sm" variant="outline" onClick={() => void accountsApi.update(account.id, { isArchived: false, isActive: true }).then(async () => { await queryClient.invalidateQueries({ queryKey: ['accounts'] }); showToast('Account restored.', 'success') }).catch((error: unknown) => showToast(getErrorMessage(error), 'error'))}><RotateCcw className="h-4 w-4" />Restore</Button>
              ) : (
                <Button size="sm" variant="outline" title="Soft delete: archive the account and retain its balances and history" onClick={() => archiveMutation.mutate(account)} disabled={archiveMutation.isPending}><Archive className="h-4 w-4" />Archive</Button>
              )}
            </div>
          </Card>
        ))}
      </section>
      <PaginationControls page={accountsQuery.data.page} totalPages={accountsQuery.data.totalPages} total={accountsQuery.data.total} limit={accountsQuery.data.limit} onPageChange={setPage} />

      <Modal open={addForm.isOpen || !!editingAccount} onClose={closeForm} title={editingAccount ? 'Edit account' : 'Add an account'} className="sm:max-w-2xl">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)} noValidate>
            <label htmlFor="account-name" className="space-y-2 text-sm font-medium">Account name<Input id="account-name" {...form.register('name')} error={form.formState.errors.name?.message} /></label>
            <label htmlFor="account-type" className="space-y-2 text-sm font-medium">Account type<select id="account-type" className={fieldClass} {...form.register('type')}>{accountTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
            <label htmlFor="institution" className="space-y-2 text-sm font-medium">Bank or institution<Input id="institution" {...form.register('institutionName')} /></label>
            <label htmlFor="masked-id" className="space-y-2 text-sm font-medium">Masked identifier<Input id="masked-id" maxLength={8} placeholder="•••• 1234" {...form.register('maskedIdentifier')} error={form.formState.errors.maskedIdentifier?.message} /></label>
            <label htmlFor="opening-balance" className="space-y-2 text-sm font-medium">Opening balance (₹)<Input id="opening-balance" type="number" step="0.01" {...form.register('openingBalance', { valueAsNumber: true })} /></label>
            <label htmlFor="opening-date" className="space-y-2 text-sm font-medium">Opening balance date<Input id="opening-date" type="date" {...form.register('openingBalanceDate')} error={form.formState.errors.openingBalanceDate?.message} /></label>
            <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={closeForm}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : editingAccount ? 'Save changes' : 'Save account'}</Button></div>
          </form>
      </Modal>
    </div>
  )
}