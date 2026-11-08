import { describe, expect, it } from 'vitest'
import { buildPlannedCashflowForecast, incomeOccurrenceDates } from './planned-cashflow'
import type { Account, MonthlyBudget, PlannedExpense, PlannedIncome } from '@/types'

const account: Account = {
  id: 'checking', name: 'Checking', type: 'SAVINGS', institutionName: '', maskedIdentifier: '',
  openingBalance: 0, openingBalanceDate: '2026-01-01', currency: 'INR', isActive: true,
  isArchived: false, balance: 10_000, createdAt: '', updatedAt: '',
}

const monthlyIncome: PlannedIncome = {
  id: 'salary', name: 'Salary', amount: 5_000, accountId: 'checking', accountName: 'Checking',
  startDate: '2026-11-30', frequency: 'MONTHLY', endDate: null, status: 'ACTIVE', notes: '',
  actuals: [], createdAt: '', updatedAt: '',
}

describe('planned cash flow', () => {
  it('generates monthly dates and clamps to month end', () => {
    expect(incomeOccurrenceDates(monthlyIncome, '2026-11-01', '2027-02-28')).toEqual([
      '2026-11-30', '2026-12-30', '2027-01-30', '2027-02-28',
    ])
  })

  it('skips income occurrences already recorded as actuals', () => {
    expect(incomeOccurrenceDates({ ...monthlyIncome, startDate: '2026-11-01', actuals: [{
      id: 'tx', scheduledDate: '2026-12-01', actualDate: '2026-12-02', amount: 4_900,
      accountId: 'checking', paymentMode: 'BANK_TRANSFER',
    }] }, '2026-11-01', '2027-01-01')).toEqual(['2026-11-01', '2027-01-01'])
  })

  it('projects dated income and expense cash flows without touching account data', () => {
    const expense: PlannedExpense = {
      id: 'trip', name: 'Trip', dueDate: '2026-12-15', status: 'PLANNED', notes: '',
      items: [{ id: 'stay', name: 'Stay', categoryId: null, categoryName: null, accountId: 'checking', accountName: 'Checking', estimatedAmount: 2_000, spentAmount: 0, remainingAmount: 2_000, overBudgetAmount: 0, spendingPercent: 0, transactions: [] }],
      summary: { estimatedAmount: 2_000, spentAmount: 0, remainingAmount: 2_000, overBudgetAmount: 0, spendingPercent: 0, transactionCount: 0 },
      createdAt: '', updatedAt: '',
    }
    const forecast = buildPlannedCashflowForecast([account], [{ ...monthlyIncome, startDate: '2026-12-01', frequency: 'ONCE' }], [expense], [], '2026-11-01', 2)

    expect(forecast.startingBalance).toBe(10_000)
    expect(forecast.days).toHaveLength(2)
    expect(forecast.endingBalance).toBe(13_000)
    expect(forecast.finalAccountBalances[0].balance).toBe(13_000)
    expect(account.balance).toBe(10_000)
  })

  it('adds planned campaign estimates on top of the unspent monthly budget, even in the same category', () => {
    const expense: PlannedExpense = {
      id: 'trip', name: 'Trip', dueDate: '2026-12-15', status: 'PLANNED', notes: '',
      items: [{ id: 'stay', name: 'Stay', categoryId: 'travel', categoryName: 'Travel', accountId: 'checking', accountName: 'Checking', estimatedAmount: 2_000, spentAmount: 0, remainingAmount: 2_000, overBudgetAmount: 0, spendingPercent: 0, transactions: [] }],
      summary: { estimatedAmount: 2_000, spentAmount: 0, remainingAmount: 2_000, overBudgetAmount: 0, spendingPercent: 0, transactionCount: 0 },
      createdAt: '', updatedAt: '',
    }
    const budget: MonthlyBudget = {
      id: 'budget-dec', year: 2026, month: 12, notes: '',
      items: [{ categoryId: 'travel', budgetAmount: 5_000, actualSpent: 1_000, remaining: 4_000, utilizationPercent: 20, status: 'normal', overBudget: 0, transactionCount: 1, averageDailySpend: 0, projectedMonthEnd: 1_000 }],
      summary: { totalBudget: 5_000, totalSpent: 1_000, remaining: 4_000, utilizationPercent: 20, status: 'normal', projectedMonthEnd: 1_000 },
    }

    const forecast = buildPlannedCashflowForecast([account], [], [expense], [budget], '2026-11-01', 2)
    const budgetEntry = forecast.days.find((day) => day.date === '2026-12-31')?.entries[0]

    expect(forecast.campaignOutflow).toBe(2_000)
    expect(forecast.budgetOutflow).toBe(4_000)
    expect(forecast.endingBalance).toBe(4_000)
    expect(budgetEntry).toMatchObject({ direction: 'EXPENSE', amount: 4_000, entryType: 'BUDGET', accountId: null })
  })

  it('keeps the full budget reserve and adds a campaign that exceeds it', () => {
    const expense: PlannedExpense = {
      id: 'trip', name: 'Trip', dueDate: '2026-12-15', status: 'PLANNED', notes: '',
      items: [{ id: 'stay', name: 'Stay', categoryId: 'travel', categoryName: 'Travel', accountId: null, accountName: null, estimatedAmount: 6_000, spentAmount: 0, remainingAmount: 6_000, overBudgetAmount: 0, spendingPercent: 0, transactions: [] }],
      summary: { estimatedAmount: 6_000, spentAmount: 0, remainingAmount: 6_000, overBudgetAmount: 0, spendingPercent: 0, transactionCount: 0 },
      createdAt: '', updatedAt: '',
    }
    const budget: MonthlyBudget = {
      id: 'budget-dec', year: 2026, month: 12, notes: '',
      items: [{ categoryId: 'travel', budgetAmount: 5_000, actualSpent: 1_000, remaining: 4_000, utilizationPercent: 20, status: 'normal', overBudget: 0, transactionCount: 1, averageDailySpend: 0, projectedMonthEnd: 1_000 }],
      summary: { totalBudget: 5_000, totalSpent: 1_000, remaining: 4_000, utilizationPercent: 20, status: 'normal', projectedMonthEnd: 1_000 },
    }

    const forecast = buildPlannedCashflowForecast([account], [], [expense], [budget], '2026-11-01', 2)

    expect(forecast.campaignOutflow).toBe(6_000)
    expect(forecast.budgetOutflow).toBe(4_000)
    expect(forecast.endingBalance).toBe(0)
  })

  it('uses the current month budget for missing months and prefers a saved month budget', () => {
    const currentBudget: MonthlyBudget = {
      id: 'budget-nov', year: 2026, month: 11, notes: '',
      items: [{ categoryId: 'food', budgetAmount: 1_000, actualSpent: 300, remaining: 700, utilizationPercent: 30, status: 'normal', overBudget: 0, transactionCount: 1, averageDailySpend: 10, projectedMonthEnd: 300 }],
      summary: { totalBudget: 1_000, totalSpent: 300, remaining: 700, utilizationPercent: 30, status: 'normal', projectedMonthEnd: 300 },
    }
    const januaryBudget: MonthlyBudget = {
      id: 'budget-jan', year: 2027, month: 1, notes: '',
      items: [{ categoryId: 'food', budgetAmount: 2_000, actualSpent: 500, remaining: 1_500, utilizationPercent: 25, status: 'normal', overBudget: 0, transactionCount: 1, averageDailySpend: 20, projectedMonthEnd: 500 }],
      summary: { totalBudget: 2_000, totalSpent: 500, remaining: 1_500, utilizationPercent: 25, status: 'normal', projectedMonthEnd: 500 },
    }

    const forecast = buildPlannedCashflowForecast([account], [], [], [currentBudget, januaryBudget], '2026-11-01', 3)
    const fallbackEntry = forecast.days.find((day) => day.date === '2026-12-31')?.entries[0]
    const savedEntry = forecast.days.find((day) => day.date === '2027-01-31')?.entries[0]

    expect(forecast.budgetOutflow).toBe(3_200)
    expect(fallbackEntry).toMatchObject({ amount: 1_000, name: 'Budget reserve 2026-12 (current month budget)' })
    expect(savedEntry).toMatchObject({ amount: 1_500, name: 'Budget reserve 2027-01' })
    expect(forecast.endingBalance).toBe(6_800)
  })

  it('shows one summed budget reserve per month instead of one row per category', () => {
    const decemberBudget: MonthlyBudget = {
      id: 'budget-dec', year: 2026, month: 12, notes: '',
      items: [
        { categoryId: 'food', budgetAmount: 3_000, actualSpent: 500, remaining: 2_500, utilizationPercent: 17, status: 'normal', overBudget: 0, transactionCount: 1, averageDailySpend: 10, projectedMonthEnd: 500 },
        { categoryId: 'transport', budgetAmount: 2_000, actualSpent: 200, remaining: 1_800, utilizationPercent: 10, status: 'normal', overBudget: 0, transactionCount: 1, averageDailySpend: 5, projectedMonthEnd: 200 },
      ],
      summary: { totalBudget: 5_000, totalSpent: 700, remaining: 4_300, utilizationPercent: 14, status: 'normal', projectedMonthEnd: 700 },
    }

    const forecast = buildPlannedCashflowForecast([account], [], [], [decemberBudget], '2026-11-01', 2)
    const budgetEntries = forecast.days.flatMap((day) => day.entries).filter((entry) => entry.entryType === 'BUDGET')

    expect(budgetEntries).toHaveLength(1)
    expect(budgetEntries[0]).toMatchObject({ date: '2026-12-31', amount: 4_300 })
  })

  it('deducts monthly budget on salary credit dates, actual or scheduled', () => {
    const salary: PlannedIncome = {
      ...monthlyIncome,
      name: 'Monthly Salary',
      startDate: '2026-12-25',
      actuals: [{
        id: 'dec-salary', scheduledDate: '2026-12-25', actualDate: '2026-12-26', amount: 5_000,
        accountId: 'checking', paymentMode: 'BANK_TRANSFER',
      }],
    }
    const decemberBudget: MonthlyBudget = {
      id: 'budget-dec', year: 2026, month: 12, notes: '',
      items: [{ categoryId: 'food', budgetAmount: 1_000, actualSpent: 0, remaining: 1_000, utilizationPercent: 0, status: 'normal', overBudget: 0, transactionCount: 0, averageDailySpend: 0, projectedMonthEnd: 0 }],
      summary: { totalBudget: 1_000, totalSpent: 0, remaining: 1_000, utilizationPercent: 0, status: 'normal', projectedMonthEnd: 0 },
    }
    const januaryBudget: MonthlyBudget = {
      ...decemberBudget,
      id: 'budget-jan', year: 2027, month: 1,
    }

    const forecast = buildPlannedCashflowForecast([account], [salary], [], [decemberBudget, januaryBudget], '2026-12-01', 2)
    const reserveEntries = forecast.days.flatMap((day) => day.entries).filter((entry) => entry.entryType === 'BUDGET')

    expect(reserveEntries).toHaveLength(2)
    expect(reserveEntries.map((entry) => entry.date)).toEqual(['2026-12-26', '2027-01-25'])
  })
})