import { describe, expect, it } from 'vitest'
import { monthsToTarget, projectWithMix, requiredMonthlyContribution } from './savings-planner'
import type { PlannerHolding, PlannerMixOption } from './savings-planner'

const zeroRateMix: PlannerMixOption[] = [{
  optionType: 'BANK_SAVINGS',
  share: 1,
  annualReturnRate: 0,
  compoundingFrequency: 'MONTHLY',
}]

describe('savings planner calculations', () => {
  it('finds the target month from current holdings and planned monthly contributions', () => {
    const holdings: PlannerHolding[] = [{
      balance: 100,
      monthlyContribution: 50,
      annualReturnRate: 0,
      compoundingFrequency: 'MONTHLY',
    }]

    expect(monthsToTarget(holdings, 250)).toBe(3)
  })

  it('solves the monthly amount required by a target date', () => {
    const holdings: PlannerHolding[] = [{
      balance: 100,
      monthlyContribution: 50,
      annualReturnRate: 0,
      compoundingFrequency: 'MONTHLY',
    }]

    expect(requiredMonthlyContribution(holdings, 400, zeroRateMix, 3)).toBe(100)
  })

  it('compounds separate options independently and combines their values', () => {
    const mix: PlannerMixOption[] = [
      { optionType: 'BANK_SAVINGS', share: 0.5, annualReturnRate: 0, compoundingFrequency: 'MONTHLY' },
      { optionType: 'FIXED_DEPOSIT', share: 0.5, annualReturnRate: 0, compoundingFrequency: 'MONTHLY' },
    ]

    expect(projectWithMix([], 100, mix, 2)).toBe(200)
  })
})