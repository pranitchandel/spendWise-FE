import type {
  AccountType,
  PaymentMode,
  RecurringFrequency,
  TransactionType,
} from '@/types'

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: 'Expense',
  INCOME: 'Income',
  LENDING: 'Lending',
  BORROWING: 'Borrowing',
  LENDING_REPAYMENT: 'Lending repayment',
  BORROWING_REPAYMENT: 'Borrowing repayment',
  TRANSFER: 'Transfer',
  REFUND: 'Refund',
}

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  UPI: 'UPI',
  DEBIT_CARD: 'Debit card',
  CREDIT_CARD: 'Credit card',
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  NET_BANKING: 'Net banking',
  OTHER: 'Other',
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  SAVINGS: 'Savings',
  CURRENT: 'Current',
  CASH: 'Cash',
  CREDIT_CARD: 'Credit card',
  OTHER: 'Other',
}

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  YEARLY: 'Yearly',
}

export const TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]
export const PAYMENT_MODES = Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]
export const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]
export const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as RecurringFrequency[]

export const BUDGET_THRESHOLDS = {
  NORMAL: 75,
  WARNING: 90,
  HIGH: 100,
} as const

export function budgetStatus(utilization: number): 'normal' | 'warning' | 'high' | 'exceeded' {
  if (utilization >= BUDGET_THRESHOLDS.HIGH) return 'exceeded'
  if (utilization >= BUDGET_THRESHOLDS.WARNING) return 'high'
  if (utilization >= BUDGET_THRESHOLDS.NORMAL) return 'warning'
  return 'normal'
}
