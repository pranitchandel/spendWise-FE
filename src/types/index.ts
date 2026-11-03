export type TransactionType =
  | 'EXPENSE'
  | 'INCOME'
  | 'LENDING'
  | 'BORROWING'
  | 'LENDING_REPAYMENT'
  | 'BORROWING_REPAYMENT'
  | 'TRANSFER'
  | 'REFUND'

export type PaymentMode =
  | 'UPI'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'NET_BANKING'
  | 'OTHER'

export type AccountType = 'SAVINGS' | 'CURRENT' | 'CASH' | 'CREDIT_CARD' | 'OTHER'

export type CategoryType =
  | 'EXPENSE'
  | 'INCOME'
  | 'LENDING'
  | 'BORROWING'
  | 'TRANSFER'
  | 'REFUND'

export type LendingStatus =
  | 'ACTIVE'
  | 'PARTIALLY_REPAID'
  | 'REPAID'
  | 'OVERDUE'
  | 'WRITTEN_OFF'

export type BorrowingStatus = LendingStatus

export type RecurringFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'

export type OccurrenceStatus = 'PENDING' | 'PAID' | 'SKIPPED' | 'POSTPONED'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
    [key: string]: unknown
  }
}

export interface ApiErrorBody {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface User {
  id: string
  email: string
  name: string
  preferredCurrency: string
  timezone: string
  theme: ThemePreference
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  user: User
}

export interface Account {
  id: string
  name: string
  type: AccountType
  institutionName: string
  maskedIdentifier: string
  openingBalance: number
  openingBalanceDate: string
  currency: string
  isActive: boolean
  isArchived: boolean
  balance?: number
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  icon: string
  color: string
  isDefault: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface Person {
  id: string
  name: string
  phone: string
  email: string
  notes: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  amount: number
  transactionDate: string
  transactionTime: string
  type: TransactionType
  categoryId: string
  category?: Category
  paymentMode: PaymentMode
  accountId: string
  account?: Account
  toAccountId?: string | null
  toAccount?: Account | null
  description: string
  note: string
  tags: string[]
  personId?: string | null
  person?: Person | null
  linkedRecordId?: string | null
  linkedRecordType?: 'LENDING' | 'BORROWING' | null
  linkedTransactionId?: string | null
  interest?: number
  isCreditCardBillPayment?: boolean
  createdAt: string
  updatedAt: string
}

export interface BudgetItem {
  categoryId: string
  category?: Category
  budgetAmount: number
  actualSpent: number
  remaining: number
  utilizationPercent: number
  status: 'normal' | 'warning' | 'high' | 'exceeded'
  overBudget: number
  transactionCount: number
  averageDailySpend: number
  projectedMonthEnd: number
}

export interface MonthlyBudget {
  id: string
  year: number
  month: number
  notes: string
  items: BudgetItem[]
  summary: {
    totalBudget: number
    totalSpent: number
    remaining: number
    utilizationPercent: number
    status: 'normal' | 'warning' | 'high' | 'exceeded'
    projectedMonthEnd: number
  }
  createdAt?: string
  updatedAt?: string
}

export interface LendingRecord {
  id: string
  personId?: string | null
  personName: string
  phone: string
  email: string
  originalAmount: number
  lendingDate: string
  sourceAccountId: string
  sourceAccount?: Account
  expectedRepaymentDate?: string | null
  interestRate?: number | null
  description: string
  notes: string
  status: LendingStatus
  outstanding: number
  totalRepaid: number
  totalInterestReceived: number
  linkedTransactionId: string
  createdAt: string
  updatedAt: string
}

export interface BorrowingRecord {
  id: string
  personId?: string | null
  lenderName: string
  phone: string
  email: string
  originalAmount: number
  borrowingDate: string
  receivingAccountId: string
  receivingAccount?: Account
  expectedRepaymentDate?: string | null
  interestRate?: number | null
  repaymentTerms: string
  notes: string
  status: BorrowingStatus
  outstanding: number
  totalRepaid: number
  totalInterestPaid: number
  linkedTransactionId: string
  createdAt: string
  updatedAt: string
}

export interface Repayment {
  id: string
  recordType: 'LENDING' | 'BORROWING'
  recordId: string
  amount: number
  interest: number
  transactionId: string
  accountId: string
  account?: Account
  repaymentDate: string
  notes: string
  createdAt: string
}

export interface RecurringOccurrence {
  id: string
  dueDate: string
  amount: number
  status: OccurrenceStatus
  paidTransactionId?: string | null
  postponedTo?: string | null
}

export interface RecurringRule {
  id: string
  name: string
  type: TransactionType
  amount: number
  frequency: RecurringFrequency
  categoryId: string
  category?: Category
  accountId: string
  account?: Account
  paymentMode: PaymentMode
  description: string
  notes?: string
  startDate: string
  endDate?: string | null
  isActive: boolean
  nextDueDate?: string | null
  toAccountId?: string | null
  occurrences?: RecurringOccurrence[]
  createdAt: string
  updatedAt: string
}

export interface DashboardReport {
  month: number
  year: number
  totalIncome: number
  totalExpenses: number
  netCashflow: number
  savings: number
  totalLendingOutstanding: number
  totalBorrowingOutstanding: number
  accountBalances: Array<{ accountId: string; name: string; balance: number; type: AccountType }>
  recentTransactions: Transaction[]
  budgetUtilization: number
  budgetTotal: number
  budgetSpent: number
  incomeByCategory: Array<{ categoryId: string; name: string; color: string; amount: number }>
  expenseByCategory: Array<{ categoryId: string; name: string; color: string; amount: number }>
  dailyTrend: Array<{ date: string; income: number; expense: number }>
}

export interface CashflowReport {
  period: string
  points: Array<{ label: string; income: number; expense: number; net: number }>
  totalIncome: number
  totalExpense: number
  net: number
}

export interface CumulativeReport {
  totalIncome: number
  totalExpenses: number
  totalLendingDisbursed: number
  totalBorrowingReceived: number
  totalLendingRecovered: number
  totalBorrowingRepaid: number
  lendingOutstanding: number
  borrowingOutstanding: number
  accountBalances: Array<{ accountId: string; name: string; balance: number }>
  runningTotals: Array<{ date: string; income: number; expense: number; net: number }>
}

export interface Paginated<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface TransactionFilters {
  page?: number
  limit?: number
  type?: TransactionType | ''
  accountId?: string
  categoryId?: string
  search?: string
  from?: string
  to?: string
  sort?: string
  view?: 'daily' | 'monthly' | 'cumulative'
  year?: number
  month?: number
}
