import { api, unwrap } from './client'
import type { Paginated, PaymentMode, SavingsCompoundingFrequency, SavingsGoal, SavingsGoalStatus, SavingsOptionType } from '@/types'

export interface SavingsAllocationInput {
  id?: string
  name: string
  optionType: SavingsOptionType
  expectedAnnualReturnRate: number
  compoundingFrequency: SavingsCompoundingFrequency
  monthlyContribution: number
}

export interface SavingsGoalInput {
  name: string
  targetAmount: number
  targetDate: string
  notes?: string
  allocations: SavingsAllocationInput[]
  status?: SavingsGoalStatus
}

export interface SavingsMovementInput {
  direction: 'DEPOSIT' | 'WITHDRAWAL'
  amount: number
  transactionDate: string
  counterpartAccountId: string
  paymentMode: PaymentMode
  categoryId: string
  note?: string
}

export const savingsApi = {
  list() {
    return unwrap<Paginated<SavingsGoal>>(api.get('/savings', { params: { page: 1, limit: 100 } })).then((data) => data.items)
  },

  listPage(params: { page: number; limit: number; status?: SavingsGoalStatus }) {
    return unwrap<Paginated<SavingsGoal>>(api.get('/savings', { params }))
  },

  create(input: SavingsGoalInput) {
    return unwrap<SavingsGoal>(api.post('/savings', input))
  },

  update(id: string, input: Partial<SavingsGoalInput>) {
    return unwrap<SavingsGoal>(api.put(`/savings/${id}`, input))
  },

  remove(id: string) {
    return unwrap<{ id: string }>(api.delete(`/savings/${id}`))
  },

  recordMovement(goalId: string, allocationId: string, input: SavingsMovementInput) {
    return unwrap<SavingsGoal>(api.post(`/savings/${goalId}/allocations/${allocationId}/movements`, input, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }))
  },
}
