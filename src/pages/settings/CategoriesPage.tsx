import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Pencil, Plus, RotateCcw, Tags } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { categoriesApi, type CategoryInput } from '@/api/categories'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { MobileFilterSheet } from '@/components/ui/MobileFilterSheet'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { useToast } from '@/contexts/ToastContext'
import type { Category, CategoryType } from '@/types'

const categoryTypes: CategoryType[] = ['EXPENSE', 'INCOME', 'LENDING', 'BORROWING', 'TRANSFER', 'REFUND']
const schema = z.object({
  name: z.string().trim().min(1, 'Enter a category name').max(80),
  type: z.enum(categoryTypes),
  icon: z.string().trim().min(1, 'Enter an icon name').max(40),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Use a six-digit hex color'),
})
type CategoryForm = z.infer<typeof schema>

const typeLabels: Record<CategoryType, string> = {
  EXPENSE: 'Expenses',
  INCOME: 'Income',
  LENDING: 'Lending',
  BORROWING: 'Borrowing',
  TRANSFER: 'Transfers',
  REFUND: 'Refunds',
}

const inputClass = 'h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'
const initialValues: CategoryForm = { name: '', type: 'EXPENSE', icon: 'circle', color: '#64748B' }

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [includeArchived, setIncludeArchived] = useState(false)
  const [draftIncludeArchived, setDraftIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'management', includeArchived, page],
    queryFn: () => categoriesApi.listPage({ includeArchived, page, limit: 20 }),
    placeholderData: (previous) => previous,
  })
  const form = useForm<CategoryForm>({ resolver: zodResolver(schema), defaultValues: initialValues })

  useEffect(() => {
    if (searchParams.get('add') !== '1') return
    setEditingCategory(null)
    form.reset(initialValues)
    setFormOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('add')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, form])

  function closeForm() {
    setFormOpen(false)
    setEditingCategory(null)
    form.reset(initialValues)
  }

  function openCreate() {
    setEditingCategory(null)
    form.reset(initialValues)
    setFormOpen(true)
  }

  function openEdit(category: Category) {
    setEditingCategory(category)
    form.reset({ name: category.name, type: category.type, icon: category.icon, color: category.color })
    setFormOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: (input: CategoryInput) => editingCategory
      ? categoriesApi.update(editingCategory.id, input)
      : categoriesApi.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      showToast(editingCategory ? 'Category updated.' : 'Category created.', 'success')
      closeForm()
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const archiveMutation = useMutation({
    mutationFn: (category: Category) => categoriesApi.remove(category.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      showToast('Category archived.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  const restoreMutation = useMutation({
    mutationFn: (category: Category) => categoriesApi.update(category.id, { isArchived: false }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      showToast('Category restored.', 'success')
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  })
  if (categoriesQuery.isLoading) return <LoadingState label="Loading categories…" />
  if (categoriesQuery.isError || !categoriesQuery.data) {
    return <div role="alert" className="text-sm text-[var(--danger)]">Categories couldn’t be loaded. Refresh to try again.</div>
  }

  function submit(values: CategoryForm) {
    saveMutation.mutate({ name: values.name, type: values.type, icon: values.icon, color: values.color })
  }

  const groups = categoryTypes
    .map((type) => ({ type, items: categoriesQuery.data.items.filter((category) => category.type === type) }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--primary)]">Organize your ledger</p>
          <h2 className="mt-1 text-2xl font-semibold">Categories</h2>
        </div>
        <Button className="hidden lg:inline-flex" onClick={openCreate}><Plus className="h-4 w-4" />Add category</Button>
      </div>

      <div className="hidden items-center gap-3 sm:flex">
        <label className="flex items-center gap-2 text-sm text-[var(--secondary)]">
          <input type="checkbox" checked={draftIncludeArchived} onChange={(event) => setDraftIncludeArchived(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Show archived categories
        </label>
        <Button type="button" size="sm" disabled={draftIncludeArchived === includeArchived} onClick={() => { setIncludeArchived(draftIncludeArchived); setPage(1) }}>Show results</Button>
      </div>
      <MobileFilterSheet open={filtersOpen} onOpenChange={(open) => { if (open) setDraftIncludeArchived(includeArchived); setFiltersOpen(open) }} onApply={() => { setIncludeArchived(draftIncludeArchived); setPage(1) }} activeCount={Number(includeArchived)}>
        <label className="flex items-center gap-2 text-sm text-[var(--secondary)]">
          <input type="checkbox" checked={draftIncludeArchived} onChange={(event) => setDraftIncludeArchived(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Show archived categories
        </label>
      </MobileFilterSheet>

      {groups.length ? groups.map(({ type, items }) => (
        <section key={type} className="space-y-3" aria-label={typeLabels[type]}>
          <h3 className="text-sm font-semibold text-[var(--secondary)]">{typeLabels[type]}</h3>
          <Card className="divide-y divide-[var(--border)] overflow-hidden p-0">
            {items.map((category) => (
              <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ color: category.color, backgroundColor: `${category.color}18` }} aria-hidden="true">
                    <Tags className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{category.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--secondary)]">{category.icon}{category.isDefault ? ' · Default' : ''}{category.isArchived ? ' · Archived' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(category)} aria-label={`Edit ${category.name}`}><Pencil className="h-4 w-4" />Edit</Button>
                  {category.isArchived ? (
                    <Button size="sm" variant="outline" onClick={() => restoreMutation.mutate(category)} disabled={restoreMutation.isPending}><RotateCcw className="h-4 w-4" />Restore</Button>
                  ) : (
                    <Button size="sm" variant="ghost" title="Soft delete: archive the category and retain its history" onClick={() => archiveMutation.mutate(category)} disabled={archiveMutation.isPending} aria-label={`Archive ${category.name}`}><Archive className="h-4 w-4" />Archive</Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </section>
      )) : (
        <Card className="p-10 text-center">
          <Tags className="mx-auto h-6 w-6 text-[var(--secondary)]" />
          <p className="mt-3 text-sm text-[var(--secondary)]">{includeArchived ? 'No categories found.' : 'No active categories.'}</p>
        </Card>
      )}
      <PaginationControls page={categoriesQuery.data.page} totalPages={categoriesQuery.data.totalPages} total={categoriesQuery.data.total} limit={categoriesQuery.data.limit} onPageChange={setPage} />

      <Modal open={formOpen} onClose={closeForm} title={editingCategory ? 'Edit category' : 'Add category'}>
        <form className="space-y-4" onSubmit={form.handleSubmit(submit)} noValidate>
          <label htmlFor="category-name" className="block space-y-2 text-sm font-medium">
            Name
            <Input id="category-name" maxLength={80} {...form.register('name')} error={form.formState.errors.name?.message} />
          </label>
          <label htmlFor="category-type" className="block space-y-2 text-sm font-medium">
            Type
            <select id="category-type" disabled={!!editingCategory} className={inputClass} {...form.register('type')}>
              {categoryTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
            </select>
          </label>
          <label htmlFor="category-icon" className="block space-y-2 text-sm font-medium">
            Icon name
            <Input id="category-icon" maxLength={40} placeholder="circle, utensils, car" {...form.register('icon')} error={form.formState.errors.icon?.message} />
          </label>
          <label htmlFor="category-color" className="flex items-center justify-between gap-3 text-sm font-medium">
            Color
            <span className="flex items-center gap-2">
              <input id="category-color" type="color" className="h-10 w-14 cursor-pointer rounded border border-[var(--border)] bg-[var(--card)] p-1" {...form.register('color')} />
              <span className="font-mono text-xs text-[var(--secondary)]">{form.watch('color')}</span>
            </span>
          </label>
          {form.formState.errors.color?.message ? <p role="alert" className="text-xs text-[var(--danger)]">{form.formState.errors.color.message}</p> : null}
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : editingCategory ? 'Save changes' : 'Create category'}</Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
