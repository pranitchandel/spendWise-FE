import { api, unwrap } from './client'
import type { Paginated, PaymentMode, PlannedIncome, PlannedIncomeFrequency, PlannedIncomeStatus } from '@/types'

export interface PlannedIncomeInput {
  name: string
  amount: number
  accountId: string
  startDate: string
  frequency: PlannedIncomeFrequency
  endDate?: string | null
  status?: PlannedIncomeStatus
  notes?: string
}

export interface PlannedIncomeActualInput {
  scheduledDate: string
  actualDate: string
  amount: number
  paymentMode: PaymentMode
  categoryId: string
  note?: string
}

export const plannedIncomesApi = {
  list() {
    return unwrap<Paginated<PlannedIncome>>(api.get('/planned-incomes', { params: { page: 1, limit: 100 } })).then((data) => data.items)
  },
  listPage(params: { page: number; limit: number; status?: PlannedIncomeStatus }) {
    return unwrap<Paginated<PlannedIncome>>(api.get('/planned-incomes', { params }))
  },
  create(input: PlannedIncomeInput) {
    return unwrap<PlannedIncome>(api.post('/planned-incomes', input))
  },
  update(id: string, input: Partial<PlannedIncomeInput>) {
    return unwrap<PlannedIncome>(api.put(`/planned-incomes/${id}`, input))
  },
  remove(id: string) {
    return unwrap<{ id: string }>(api.delete(`/planned-incomes/${id}`))
  },
  recordActual(id: string, input: PlannedIncomeActualInput) {
    return unwrap<PlannedIncome>(api.post(`/planned-incomes/${id}/actuals`, input, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }))
  },
}