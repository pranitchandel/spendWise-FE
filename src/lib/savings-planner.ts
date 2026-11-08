import type { SavingsCompoundingFrequency, SavingsOptionType } from '@/types'

export interface PlannerHolding {
  balance: number
  monthlyContribution: number
  annualReturnRate: number
  compoundingFrequency: SavingsCompoundingFrequency
}

export interface PlannerMixOption {
  optionType: SavingsOptionType
  share: number
  annualReturnRate: number
  compoundingFrequency: SavingsCompoundingFrequency
}

export const PLANNER_MIXES = [
  { id: 'steady', label: 'Steadier mix', weights: { BANK_SAVINGS: 0.5, FIXED_DEPOSIT: 0.5 } },
  { id: 'balanced', label: 'Balanced mix', weights: { RECURRING_DEPOSIT: 0.3, PPF: 0.3, MUTUAL_FUND: 0.4 } },
  { id: 'growth', label: 'Growth-leaning mix', weights: { PPF: 0.2, MUTUAL_FUND: 0.8 } },
] as const

const periodsPerYear: Record<SavingsCompoundingFrequency, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  HALF_YEARLY: 2,
  YEARLY: 1,
}

function monthlyRate(annualReturnRate: number, frequency: SavingsCompoundingFrequency) {
  const periods = periodsPerYear[frequency]
  return Math.pow(1 + annualReturnRate / 100 / periods, periods / 12) - 1
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100
}

export function projectWithMix(
  holdings: PlannerHolding[],
  monthlyContribution: number,
  mix: PlannerMixOption[],
  months: number,
) {
  const heldValues = holdings.map((holding) => ({
    value: holding.balance,
    contribution: holding.monthlyContribution,
    rate: monthlyRate(holding.annualReturnRate, holding.compoundingFrequency),
  }))
  const mixValues = mix.map((option) => ({
    value: 0,
    contribution: monthlyContribution * option.share,
    rate: monthlyRate(option.annualReturnRate, option.compoundingFrequency),
  }))

  for (let month = 0; month < months; month += 1) {
    for (const holding of heldValues) {
      holding.value = roundMoney(holding.value * (1 + holding.rate) + holding.contribution)
    }
    for (const option of mixValues) {
      option.value = roundMoney(option.value * (1 + option.rate) + option.contribution)
    }
  }

  return roundMoney([...heldValues, ...mixValues].reduce((total, item) => total + item.value, 0))
}

export function monthsToTarget(holdings: PlannerHolding[], target: number, limit = 1200) {
  const current = holdings.reduce((total, holding) => total + holding.balance, 0)
  if (current >= target) return 0

  for (let months = 1; months <= limit; months += 1) {
    if (projectWithMix(holdings, 0, [], months) >= target) return months
  }
  return null
}

export function requiredMonthlyContribution(
  holdings: PlannerHolding[],
  target: number,
  mix: PlannerMixOption[],
  months: number,
) {
  const startingHoldings = holdings.map((holding) => ({ ...holding, monthlyContribution: 0 }))
  if (months <= 0 || projectWithMix(startingHoldings, 0, mix, months) >= target) return 0

  let low = 0
  let high = target
  while (projectWithMix(startingHoldings, high, mix, months) < target && high < Number.MAX_SAFE_INTEGER / 100) {
    high *= 2
  }

  for (let iteration = 0; iteration < 60; iteration += 1) {
    const midpoint = (low + high) / 2
    if (projectWithMix(startingHoldings, midpoint, mix, months) >= target) high = midpoint
    else low = midpoint
  }
  return roundMoney(high)
}