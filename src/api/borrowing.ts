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
    return unwrap<BorrowingRecord & { repayments?: Repayment[] }>(api.get(`/borrowing/${id}`))
  },

  create(input: BorrowingInput) {
    return unwrap<BorrowingRecord>(api.post('/borrowing', input))
  },

  addRepayment(id: string, input: RepaymentInput) {
    return unwrap<Repayment>(api.post(`/borrowing/${id}/repayments`, input))
  },
}
