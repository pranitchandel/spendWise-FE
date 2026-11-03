import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Pencil, Plus, RotateCcw, Tags, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { categoriesApi, type CategoryInput } from '@/api/categories'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
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
  const [includeArchived, setIncludeArchived] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'management', includeArchived],
    queryFn: () => categoriesApi.list({ includeArchived }),
  })
  const form = useForm<CategoryForm>({ resolver: zodResolver(schema), defaultValues: initialValues })

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
  const deleteMutation = useMutation({
    mutationFn: (category: Category) => categoriesApi.permanentlyDelete(category.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      setCategoryToDelete(null)
      showToast('Category permanently deleted.', 'success')
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
    .map((type) => ({ type, items: categoriesQuery.data.filter((category) => category.type === type) }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--primary)]">Organize your ledger</p>
          <h2 className="mt-1 text-2xl font-semibold">Categories</h2>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add category</Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--secondary)]">
        <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Show archived categories
      </label>

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
                    <Button size="sm" variant="ghost" onClick={() => archiveMutation.mutate(category)} disabled={archiveMutation.isPending} aria-label={`Archive ${category.name}`}><Archive className="h-4 w-4" />Archive</Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setCategoryToDelete(category)} disabled={deleteMutation.isPending} aria-label={`Permanently delete ${category.name}`} title="Permanently delete">
                    <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                  </Button>
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

      {categoryToDelete ? (
        <Modal open onClose={() => { if (!deleteMutation.isPending) setCategoryToDelete(null) }} title="Permanently delete category?" className="sm:max-w-md">
          <p className="text-sm leading-6 text-[var(--secondary)]">
            Permanently delete <span className="font-semibold text-[var(--foreground)]">{categoryToDelete.name}</span>? Categories used by transactions, budgets, or recurring schedules cannot be deleted; archive them instead.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => setCategoryToDelete(null)}>Cancel</Button>
            <Button variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(categoryToDelete)}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete category'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
