import type { Account, MonthlyBudget, PlannedExpense, PlannedIncome } from '@/types'

export interface CashflowEntry {
  date: string
  name: string
  direction: 'INCOME' | 'EXPENSE'
  amount: number
  accountId: string | null
  accountName: string | null
  categoryId?: string
  entryType?: 'PLAN' | 'BUDGET'
}

export interface CashflowDay {
  date: string
  income: number
  expenses: number
  net: number
  projectedBalance: number
  entries: CashflowEntry[]
  accountBalances: Array<{ accountId: string; name: string; balance: number }>
}

export interface PlannedCashflowForecast {
  startingBalance: number
  endingBalance: number
  unscheduledExpenses: number
  budgetOutflow: number
  campaignOutflow: number
  days: CashflowDay[]
  finalAccountBalances: Array<{ accountId: string; name: string; balance: number }>
}

function dateParts(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return { year, month, day }
}

function dateString(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function addMonths(date: string, months: number) {
  const parts = dateParts(date)
  const monthIndex = parts.month - 1 + months
  const year = parts.year + Math.floor(monthIndex / 12)
  const month = monthIndex % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return dateString(year, month + 1, Math.min(parts.day, lastDay))
}

export function incomeScheduleDates(income: PlannedIncome, throughDate: string) {
  const dates: string[] = []
  if (income.frequency === 'ONCE') {
    if (income.startDate <= throughDate) dates.push(income.startDate)
    return dates
  }

  for (let month = 0; month <= 1200; month += 1) {
    const date = addMonths(income.startDate, month)
    if (date > throughDate || (income.endDate && date > income.endDate)) break
    dates.push(date)
  }
  return dates
}

export function incomeOccurrenceDates(income: PlannedIncome, fromDate: string, throughDate: string) {
  const actualDates = new Set(income.actuals.map((actual) => actual.scheduledDate))
  return incomeScheduleDates(income, throughDate).filter((date) => date >= fromDate && !actualDates.has(date))
}

function monthlyBudgetDate(incomes: PlannedIncome[], monthStart: string, monthEnd: string, today: string) {
  const salaryPlans = incomes.filter((income) => income.status === 'ACTIVE' && /salary/i.test(income.name))
  const salaryDates = salaryPlans.flatMap((income) => {
    const creditedDates = income.actuals
      .filter((actual) => actual.scheduledDate >= monthStart && actual.scheduledDate <= monthEnd)
      .map((actual) => actual.actualDate < today ? today : actual.actualDate)
    const pendingDates = incomeOccurrenceDates(income, today, monthEnd)
      .filter((date) => date >= monthStart && date <= monthEnd)
    return [...creditedDates, ...pendingDates]
  }).sort((left, right) => left.localeCompare(right))
  return salaryDates[0] ?? monthEnd
}

export function buildPlannedCashflowForecast(
  accounts: Account[],
  incomes: PlannedIncome[],
  expenses: PlannedExpense[],
  budgets: MonthlyBudget[],
  today: string,
  horizonMonths = 12,
): PlannedCashflowForecast {
  const throughDate = addMonths(today, horizonMonths)
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const entries: CashflowEntry[] = []
  let unscheduledExpenses = 0

  for (const income of incomes) {
    if (income.status !== 'ACTIVE') continue
    for (const date of incomeOccurrenceDates(income, today, throughDate)) {
      entries.push({
        date,
        name: income.name,
        direction: 'INCOME',
        amount: income.amount,
        accountId: income.accountId,
        accountName: accountById.get(income.accountId)?.name ?? income.accountName,
      })
    }
  }

  for (const campaign of expenses) {
    if (campaign.status !== 'PLANNED') continue
    if (!campaign.dueDate || campaign.dueDate < today || campaign.dueDate > throughDate) {
      if (!campaign.dueDate) unscheduledExpenses += campaign.items.reduce((sum, item) => sum + Math.max(0, item.remainingAmount), 0)
      continue
    }
    for (const item of campaign.items) {
      if (item.remainingAmount <= 0) continue
      entries.push({
        date: campaign.dueDate,
        name: `${campaign.name} · ${item.name}`,
        direction: 'EXPENSE',
        amount: item.remainingAmount,
        accountId: item.accountId,
        accountName: item.accountName ?? (item.accountId ? accountById.get(item.accountId)?.name ?? null : null),
        categoryId: item.categoryId ?? undefined,
        entryType: 'PLAN',
      })
    }
  }

  let budgetOutflow = 0
  let campaignOutflow = entries.filter((entry) => entry.direction === 'EXPENSE').reduce((total, entry) => total + entry.amount, 0)
  const monthlyBudgetReserves = new Map<string, { amount: number; isFallback: boolean; date: string }>()
  const todayParts = dateParts(today)
  const currentBudget = budgets.find((budget) => budget.year === todayParts.year && budget.month === todayParts.month)
  let forecastMonth = dateString(todayParts.year, todayParts.month, 1)
  while (forecastMonth <= throughDate) {
    const monthParts = dateParts(forecastMonth)
    const exactBudget = budgets.find((budget) => budget.year === monthParts.year && budget.month === monthParts.month)
    const budget = exactBudget ?? currentBudget
    if (budget) {
      const monthStart = forecastMonth
      const monthEnd = dateString(monthParts.year, monthParts.month, new Date(Date.UTC(monthParts.year, monthParts.month, 0)).getUTCDate())
      const isFutureFallback = !exactBudget && (monthParts.year !== todayParts.year || monthParts.month !== todayParts.month)
      if (monthEnd <= throughDate) {
        for (const item of budget.items) {
          const actualSpent = isFutureFallback ? 0 : item.actualSpent
          const remainingBudget = Math.max(0, item.budgetAmount - actualSpent)
          if (remainingBudget <= 0) continue
          const alreadyPlanned = entries
            .filter((entry) => entry.direction === 'EXPENSE' && entry.categoryId === item.categoryId && entry.date >= monthStart && entry.date <= monthEnd)
            .reduce((total, entry) => total + entry.amount, 0)
          const remainingEnvelope = Math.max(0, remainingBudget - alreadyPlanned)
          if (!remainingEnvelope) continue
          budgetOutflow += remainingEnvelope
          const monthKey = `${monthParts.year}-${monthParts.month.toString().padStart(2, '0')}`
          const currentReserve = monthlyBudgetReserves.get(monthKey)
          monthlyBudgetReserves.set(monthKey, {
            amount: (currentReserve?.amount ?? 0) + remainingEnvelope,
            isFallback: isFutureFallback,
            date: monthlyBudgetDate(incomes, monthStart, monthEnd, today),
          })
        }
      }
    }
    forecastMonth = addMonths(forecastMonth, 1)
  }
  for (const [monthKey, reserve] of monthlyBudgetReserves) {
    entries.push({
      date: reserve.date,
      name: `Budget reserve ${monthKey}${reserve.isFallback ? ' (current month budget)' : ''}`,
      direction: 'EXPENSE',
      amount: reserve.amount,
      accountId: null,
      accountName: null,
      entryType: 'BUDGET',
    })
  }

  entries.sort((left, right) => left.date.localeCompare(right.date) || left.direction.localeCompare(right.direction) || left.name.localeCompare(right.name))
  const accountBalances = new Map(accounts.map((account) => [account.id, account.balance ?? 0]))
  const startingBalance = [...accountBalances.values()].reduce((total, balance) => total + balance, 0)
  let projectedBalance = startingBalance
  const grouped = new Map<string, CashflowEntry[]>()
  for (const entry of entries) grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry])

  const days = [...grouped.entries()].map(([date, dayEntries]) => {
    const income = dayEntries.filter((entry) => entry.direction === 'INCOME').reduce((total, entry) => total + entry.amount, 0)
    const expensesOnDay = dayEntries.filter((entry) => entry.direction === 'EXPENSE').reduce((total, entry) => total + entry.amount, 0)
    for (const entry of dayEntries) {
      const direction = entry.direction === 'INCOME' ? 1 : -1
      projectedBalance += direction * entry.amount
      if (entry.accountId && accountBalances.has(entry.accountId)) {
        accountBalances.set(entry.accountId, (accountBalances.get(entry.accountId) ?? 0) + direction * entry.amount)
      }
    }
    return {
      date,
      income,
      expenses: expensesOnDay,
      net: income - expensesOnDay,
      projectedBalance,
      entries: dayEntries,
      accountBalances: accounts.map((account) => ({
        accountId: account.id,
        name: account.name,
        balance: accountBalances.get(account.id) ?? 0,
      })),
    }
  })

  return {
    startingBalance,
    endingBalance: projectedBalance,
    unscheduledExpenses,
    budgetOutflow,
    campaignOutflow,
    days,
    finalAccountBalances: accounts.map((account) => ({
      accountId: account.id,
      name: account.name,
      balance: accountBalances.get(account.id) ?? 0,
    })),
  }
}