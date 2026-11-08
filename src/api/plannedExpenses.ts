import { api, unwrap } from './client'
import type { Paginated, PlannedExpense } from '@/types'

export interface PlannedExpenseInput {
  name: string
  dueDate?: string | null
  items: Array<{ id?: string; name: string; categoryId: string; accountId?: string | null; estimatedAmount: number }>
  status?: PlannedExpense['status']
  notes?: string
}

export interface CampaignSpendInput {
  itemId: string
  amount: number
  transactionDate: string
  accountId: string
  paymentMode: string
  note?: string
  categoryId?: string
}

export const plannedExpensesApi = {
  list() {
    return unwrap<Paginated<PlannedExpense>>(api.get('/planned-expenses', { params: { page: 1, limit: 100 } })).then((data) => data.items)
  },

  listPage(params: { page: number; limit: number; status?: PlannedExpense['status'] }) {
    return unwrap<Paginated<PlannedExpense>>(api.get('/planned-expenses', { params }))
  },

  create(input: PlannedExpenseInput) {
    return unwrap<PlannedExpense>(api.post('/planned-expenses', input))
  },

  update(id: string, input: Partial<PlannedExpenseInput>) {
    return unwrap<PlannedExpense>(api.put(`/planned-expenses/${id}`, input))
  },

  remove(id: string) {
    return unwrap<{ id: string }>(api.delete(`/planned-expenses/${id}`))
  },

  spend(id: string, input: CampaignSpendInput, idempotencyKey: string) {
    return unwrap<PlannedExpense>(api.post(`/planned-expenses/${id}/spend`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }))
  },
}