import { api, unwrap } from './client'
import type { MonthlyBudget, MonthlyCategorySpending } from '@/types'

export interface BudgetItemInput {
  categoryId: string
  amount: number
}

export interface BudgetInput {
  year: number
  month: number
  items: BudgetItemInput[]
}

export const budgetsApi = {
  list(params?: { year?: number }) {
    return unwrap<MonthlyBudget[] | { items: MonthlyBudget[] }>(api.get('/budgets', { params: { ...params, page: 1, limit: 100 } })).then((data) => Array.isArray(data) ? data : data.items)
  },

  listPage(params: { year?: number; page: number; limit: number }) {
    return unwrap<{ items: MonthlyBudget[]; page: number; limit: number; total: number; totalPages: number }>(api.get('/budgets', { params }))
  },

  getMonth(year: number, month: number) {
    return unwrap<MonthlyBudget>(api.get(`/budgets/${year}/${month}`))
  },

  getMonthlySpendingByCategory(year: number, month: number) {
    return unwrap<MonthlyCategorySpending[]>(api.get(`/budgets/${year}/${month}/actuals`))
  },

  create(input: BudgetInput) {
    return unwrap<MonthlyBudget>(api.post('/budgets', input))
  },

  update(id: string, input: { items: BudgetItemInput[] }) {
    return unwrap<MonthlyBudget>(api.put(`/budgets/${id}`, input))
  },

  copy(input: {
    fromYear: number
    fromMonth: number
    toYear: number
    toMonth: number
  }) {
    return unwrap<MonthlyBudget>(api.post('/budgets/copy', input))
  },
}
