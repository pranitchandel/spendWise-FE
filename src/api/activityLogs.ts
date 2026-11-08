import { api } from './client'
import type { ApiSuccess, Paginated, TransactionType } from '@/types'

export type ActivityAction = 'CREATED' | 'UPDATED' | 'DELETED'
export type ActivitySource =
  | 'MANUAL'
  | 'PLANNED_EXPENSE'
  | 'PLANNED_INCOME'
  | 'SAVINGS'
  | 'LENDING'
  | 'BORROWING'
  | 'REPAYMENT'
  | 'REFUND'

export interface ActivityContext {
  accounts: Array<{ accountId: string; name: string; balanceBefore: number; balanceAfter: number }>
  loan: { kind: 'LENDING' | 'BORROWING'; person: string; status: string; original: number; outstanding: number; repaid: number; interest: number } | null
  originalExpense: { id: string; amount: number; refunded: number; remainingRefundable: number } | null
  campaign: { name: string; status: string; estimated: number; spent: number; remaining: number; transactionCount: number } | null
  plannedIncome: { name: string; status: string; plannedAmount: number; recordedCount: number; recordedTotal: number } | null
  savingsGoal: { name: string; status: string; target: number; saved: number; remaining: number } | null
}

export interface ActivityLog {
  id: string
  transactionId: string
  action: ActivityAction
  transactionType: TransactionType
  source: ActivitySource
  amount: number
  effects: Array<{ accountId: string; delta: number }>
  changes: Array<{ field: string; from: unknown; to: unknown }>
  snapshot: Record<string, unknown>
  context: ActivityContext | null
  occurredAt: string
}

export interface ActivityLogFilters {
  page?: number
  limit?: number
  action?: ActivityAction | ''
  transactionType?: TransactionType | ''
  source?: ActivitySource | ''
  accountId?: string
  transactionId?: string
  from?: string
  to?: string
}

export const activityLogsApi = {
  listPage(filters: ActivityLogFilters = {}) {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined),
    )
    return api.get<ApiSuccess<ActivityLog[]>>('/activity-logs', { params }).then(({ data }) => {
      const pagination = data.meta?.pagination as Partial<Paginated<ActivityLog>> | undefined
      return {
        items: data.data,
        page: pagination?.page ?? Number(filters.page ?? 1),
        limit: pagination?.limit ?? Number(filters.limit ?? 25),
        total: pagination?.total ?? data.data.length,
        totalPages: pagination?.totalPages ?? 1,
      }
    })
  },
}
