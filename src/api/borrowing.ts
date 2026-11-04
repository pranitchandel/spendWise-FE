import { api, unwrap } from './client'
import type { BorrowingRecord, Paginated, PaymentMode, Repayment } from '@/types'
import type { RepaymentInput } from './lending'

export interface BorrowingInput {
  type: 'BORROWING'
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
  repaymentTerms?: string
  notes?: string
}

export const borrowingApi = {
  list(params?: { status?: string; page?: number; limit?: number }) {
    return unwrap<BorrowingRecord[] | Paginated<BorrowingRecord>>(
      api.get('/borrowing', { params }),
    ).then((data) => (Array.isArray(data) ? data : data.items))
  },

  get(id: string) {
    return unwrap<BorrowingRecord & { categoryId: string; paymentMode: PaymentMode; repayments?: Repayment[] }>(api.get(`/borrowing/${id}`))
  },

  create(input: BorrowingInput) {
    const { notes, ...data } = input
    return unwrap<BorrowingRecord>(api.post('/borrowing', { ...data, note: notes }))
  },

  update(id: string, input: BorrowingInput) {
    return unwrap<BorrowingRecord & { categoryId: string; paymentMode: PaymentMode }>(api.put(`/borrowing/${id}`, input))
  },

  remove(id: string) {
    return unwrap<{ deleted: boolean }>(api.delete(`/borrowing/${id}`))
  },

  addRepayment(id: string, input: RepaymentInput) {
    return unwrap<Repayment>(api.post(`/borrowing/${id}/repayments`, input))
  },
}
