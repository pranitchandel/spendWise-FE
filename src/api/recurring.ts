import { api, unwrap } from './client'
import type {
  PaymentMode,
  RecurringFrequency,
  RecurringRule,
  TransactionType,
} from '@/types'

export interface RecurringInput {
  name: string
  type: TransactionType
  amount: number
  frequency: RecurringFrequency
  categoryId: string
  accountId: string
  toAccountId?: string | null
  paymentMode: PaymentMode
  description?: string
  notes?: string
  startDate: string
  endDate?: string | null
}

export interface OccurrenceAction {
  action: 'PAID' | 'SKIPPED' | 'POSTPONED'
  accountId?: string
  paymentMode?: PaymentMode
  postponedTo?: string
  note?: string
}

export const recurringApi = {
  list() {
    return unwrap<RecurringRule[]>(api.get('/recurring')).then((data) =>
      Array.isArray(data) ? data : [],
    )
  },

  create(input: RecurringInput) {
    return unwrap<RecurringRule>(api.post('/recurring', input))
  },

  update(id: string, input: Partial<RecurringInput> & { isActive?: boolean }) {
    return unwrap<RecurringRule>(api.put(`/recurring/${id}`, input))
  },

  delete(id: string) {
    return unwrap<RecurringRule>(api.delete(`/recurring/${id}`))
  },

  generate(through: string) {
    return unwrap<{ generated: number }>(api.post('/recurring/generate', { through }))
  },

  updateOccurrence(id: string, occurrenceId: string, body: OccurrenceAction) {
    return unwrap<RecurringRule>(
      api.post(`/recurring/${id}/occurrences/${occurrenceId}/mark-paid`, body),
    )
  },
}
