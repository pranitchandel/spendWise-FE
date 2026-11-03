import { api, unwrap } from './client'
import type { CashflowReport, CumulativeReport, DashboardReport } from '@/types'

export const reportsApi = {
  dashboard(params?: { year?: number; month?: number }) {
    return unwrap<DashboardReport>(api.get('/reports/dashboard', { params }))
  },

  income(params?: { from?: string; to?: string }) {
    return unwrap<{
      total: number
      byCategory: Array<{ categoryId: string; name: string; color: string; amount: number }>
      trend: Array<{ label: string; amount: number }>
    }>(api.get('/reports/income', { params }))
  },

  expenses(params?: { from?: string; to?: string }) {
    return unwrap<{
      total: number
      byCategory: Array<{ categoryId: string; name: string; color: string; amount: number }>
      trend: Array<{ label: string; amount: number }>
      daily: Array<{ date: string; amount: number }>
    }>(api.get('/reports/expenses', { params }))
  },

  budgets(params?: { year?: number; month?: number }) {
    return unwrap<{
      totalBudget: number
      totalSpent: number
      items: Array<{
        categoryId: string
        name: string
        budget: number
        spent: number
        utilization: number
      }>
    }>(api.get('/reports/budgets', { params }))
  },

  lending() {
    return unwrap<{
      totalLent: number
      totalRecovered: number
      outstanding: number
      overdue: number
      byPerson: Array<{ name: string; outstanding: number; original: number }>
    }>(api.get('/reports/lending'))
  },

  borrowing() {
    return unwrap<{
      totalBorrowed: number
      totalRepaid: number
      outstanding: number
      overdue: number
      byPerson: Array<{ name: string; outstanding: number; original: number }>
    }>(api.get('/reports/borrowing'))
  },

  cashflow(params?: { from?: string; to?: string; granularity?: string }) {
    return unwrap<CashflowReport>(api.get('/reports/cashflow', { params }))
  },

  cumulative(params?: { from?: string; to?: string }) {
    return unwrap<CumulativeReport>(api.get('/reports/cumulative', { params }))
  },
}
