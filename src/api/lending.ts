import { api, unwrap } from './client'
import type { LendingRecord, Paginated, PaymentMode, Repayment } from '@/types'

export interface LendingInput {
  type: 'LENDING'
  personName: string
  phone?: string
  email?: string
  personId?: string | null
  amount: number
  transactionDate: string
  accountId: string
  paymentMode: PaymentMode
  categoryId: string
  expectedRepaymentDate?: string | null
  interestRate?: number | null
  description?: string
  notes?: string
}

export interface RepaymentInput {
  amount: number
  interestAmount?: number
  accountId: string
  paymentMode: PaymentMode
  transactionDate: string
  categoryId: string
  note?: string
}

export interface LendingListPage extends Paginated<LendingRecord> {
  totalOutstanding: number
}

export const lendingApi = {
  list(params?: { status?: string; page?: number; limit?: number }) {
    return unwrap<Paginated<LendingRecord>>(api.get('/lending', { params }))
  },

  listPage(params: { status?: string; search?: string; page: number; limit: number }) {
    return unwrap<LendingListPage>(api.get('/lending', { params }))
  },

  get(id: string) {
    return unwrap<LendingRecord & { categoryId: string; paymentMode: PaymentMode; repayments?: Repayment[] }>(api.get(`/lending/${id}`))
  },

  create(input: LendingInput) {
    const { notes, ...data } = input
    return unwrap<LendingRecord>(api.post('/lending', { ...data, note: notes }))
  },

  update(id: string, input: LendingInput) {
    return unwrap<LendingRecord & { categoryId: string; paymentMode: PaymentMode }>(api.put(`/lending/${id}`, input))
  },

  remove(id: string) {
    return unwrap<{ deleted: boolean }>(api.delete(`/lending/${id}`))
  },

  addRepayment(id: string, input: RepaymentInput) {
    return unwrap<Repayment>(api.post(`/lending/${id}/repayments`, input))
  },
}
