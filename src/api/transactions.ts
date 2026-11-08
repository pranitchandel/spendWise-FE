import { api, unwrap } from './client'
import type { ApiSuccess, Paginated, PaymentMode, Transaction, TransactionFilters, TransactionType } from '@/types'

export interface TransactionInput {
  amount: number
  transactionDate: string
  transactionTime?: string
  type: TransactionType
  categoryId: string
  paymentMode: PaymentMode
  accountId: string
  toAccountId?: string | null
  description?: string
  note?: string
  tags?: string[]
  personId?: string | null
  personName?: string
  phone?: string
  email?: string
  linkedRecordId?: string | null
  linkedRecordType?: 'LENDING' | 'BORROWING' | null
  linkedTransactionId?: string | null
  interestAmount?: number
  isCreditCardBillPayment?: boolean
}

export interface MonthlyTransactionSummary {
  year: number
  month: number
  totals: Record<string, number>
  transactionCount: number
}

function normalizeList(
  data: Paginated<Transaction> | Transaction[] | { transactions: Transaction[] },
): Paginated<Transaction> {
  if (Array.isArray(data)) {
    return { items: data, page: 1, limit: data.length, total: data.length, totalPages: 1 }
  }
  if ('items' in data) return data
  if ('transactions' in data) {
    return {
      items: data.transactions,
      page: 1,
      limit: data.transactions.length,
      total: data.transactions.length,
      totalPages: 1,
    }
  }
  return { items: [], page: 1, limit: 20, total: 0, totalPages: 0 }
}

export const transactionsApi = {
  listPage(filters: TransactionFilters = {}) {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined),
    )
    return api.get<ApiSuccess<Transaction[]>>('/transactions', { params }).then(({ data }) => {
      const pagination = data.meta?.pagination as Partial<Paginated<Transaction>> | undefined
      return {
        items: data.data,
        page: pagination?.page ?? Number(filters.page ?? 1),
        limit: pagination?.limit ?? Number(filters.limit ?? 20),
        total: pagination?.total ?? data.data.length,
        totalPages: pagination?.totalPages ?? 1,
      }
    })
  },

  async list(filters: TransactionFilters = {}) {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined),
    )
    const data = await unwrap<Paginated<Transaction> | Transaction[]>(
      api.get('/transactions', { params }),
    )
    return normalizeList(data)
  },

  monthlySummary(year: number, month: number) {
    return unwrap<MonthlyTransactionSummary>(
      api.get('/transactions/summary/monthly', { params: { year, month } }),
    )
  },

  get(id: string) {
    return unwrap<Transaction>(api.get(`/transactions/${id}`))
  },

  create(input: TransactionInput, idempotencyKey?: string) {
    return unwrap<Transaction>(
      api.post('/transactions', input, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      }),
    )
  },

  update(id: string, input: Partial<TransactionInput>) {
    return unwrap<Transaction>(api.put(`/transactions/${id}`, input))
  },

  remove(id: string) {
    return unwrap<{ id: string } | void>(api.delete(`/transactions/${id}`))
  },
}
