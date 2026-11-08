import { api, unwrap } from './client'
import type { Account, AccountType, Paginated, Transaction } from '@/types'

export interface AccountInput {
  name: string
  type: AccountType
  institutionName?: string
  maskedIdentifier?: string
  openingBalance: number
  openingBalanceDate: string
  currency?: string
}

export const accountsApi = {
  list(params: { includeArchived?: boolean; page?: number; limit?: number } = {}) {
    return unwrap<Account[] | Paginated<Account>>(api.get('/accounts', { params: { page: 1, limit: 100, ...params } })).then((data) =>
      Array.isArray(data) ? data : data.items,
    )
  },

  listPage(params: { includeArchived?: boolean; page: number; limit: number }) {
    return unwrap<Paginated<Account>>(api.get('/accounts', { params }))
  },

  get(id: string) {
    return unwrap<Account>(api.get(`/accounts/${id}`))
  },

  create(input: AccountInput) {
    return unwrap<Account>(api.post('/accounts', input))
  },

  update(id: string, input: Partial<AccountInput> & { isActive?: boolean; isArchived?: boolean }) {
    return unwrap<Account>(api.put(`/accounts/${id}`, input))
  },

  remove(id: string) {
    return unwrap<{ id: string } | void>(api.delete(`/accounts/${id}`))
  },

  balance(id: string) {
    return unwrap<{ balance: number }>(api.get(`/accounts/${id}/balance`))
  },

  transactions(id: string, params?: { page?: number; limit?: number }) {
    return unwrap<Paginated<Transaction> | Transaction[]>(
      api.get(`/accounts/${id}/transactions`, { params }),
    )
  },
}
