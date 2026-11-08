import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CurrencyAmount } from '@/components/ui/CurrencyAmount'
import { Input } from '@/components/ui/Input'
import { monthsToTarget, PLANNER_MIXES, requiredMonthlyContribution, type PlannerHolding, type PlannerMixOption } from '@/lib/savings-planner'
import type { SavingsCompoundingFrequency, SavingsGoal, SavingsOptionType } from '@/types'

const optionTypes: SavingsOptionType[] = ['BANK_SAVINGS', 'RECURRING_DEPOSIT', 'FIXED_DEPOSIT', 'PPF', 'MUTUAL_FUND']
const optionLabels: Record<SavingsOptionType, string> = {
  BANK_SAVINGS: 'Bank savings',
  RECURRING_DEPOSIT: 'Recurring deposit',
  FIXED_DEPOSIT: 'Fixed deposit',
  PPF: 'PPF',
  MUTUAL_FUND: 'Mutual fund',
  OTHER: 'Other',
}
const defaultRates: Record<SavingsOptionType, number> = {
  BANK_SAVINGS: 3,
  RECURRING_DEPOSIT: 6.5,
  FIXED_DEPOSIT: 7,
  PPF: 7.1,
  MUTUAL_FUND: 10,
  OTHER: 5,
}
const frequencies: Array<{ value: SavingsCompoundingFrequency; label: string }> = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-yearly' },
  { value: 'YEARLY', label: 'Yearly' },
]

function monthsUntil(dateValue: string) {
  if (!dateValue) return 0
  const today = new Date()
  const targetDate = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(targetDate.getTime()) || targetDate <= new Date(today.getFullYear(), today.getMonth(), today.getDate())) return 0
  const monthDifference = (targetDate.getFullYear() - today.getFullYear()) * 12 + targetDate.getMonth() - today.getMonth()
  return monthDifference + (targetDate.getDate() > today.getDate() ? 1 : 0)
}

function monthsLabel(months: number | null) {
  if (months === null) return 'Not reached within 100 years'
  if (months === 0) return 'Already reached'
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (!years) return `${months} ${months === 1 ? 'month' : 'months'}`
  if (!remainingMonths) return `${years} ${years === 1 ? 'year' : 'years'}`
  return `${years} ${years === 1 ? 'year' : 'years'} ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`
}

function todayISODate() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

export function SavingsPlanner({ goals }: { goals: SavingsGoal[] }) {
  const eligibleGoals = goals.filter((goal) => goal.status === 'ACTIVE' || goal.status === 'PAUSED')
  const [selectedGoalId, setSelectedGoalId] = useState(eligibleGoals[0]?.id ?? '')
  const selectedGoal = eligibleGoals.find((goal) => goal.id === selectedGoalId) ?? eligibleGoals[0]

  return (
    <section className="space-y-4" aria-label="Savings goal planner">
      <div>
        <h3 className="text-lg font-semibold">Goal planner</h3>
        <p className="mt-1 text-sm text-[var(--secondary)]">Estimate time to target and compare monthly contribution mixes. Calculations are illustrative, not investment advice.</p>
      </div>
      {eligibleGoals.length ? <>
        <label className="block max-w-xl space-y-2 text-sm font-medium" htmlFor="planner-goal">Plan for goal
          <select id="planner-goal" className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]" value={selectedGoal?.id ?? ''} onChange={(event) => setSelectedGoalId(event.target.value)}>
            {eligibleGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
          </select>
        </label>
        {selectedGoal ? <PlannerGoal key={selectedGoal.id} goal={selectedGoal} /> : null}
      </> : <Card className="p-6 text-sm text-[var(--secondary)]">Create or activate a savings goal to start planning.</Card>}
    </section>
  )
}

function PlannerGoal({ goal }: { goal: SavingsGoal }) {
  const [targetAmount, setTargetAmount] = useState(goal.targetAmount)
  const [targetDate, setTargetDate] = useState(goal.targetDate >= todayISODate() ? goal.targetDate : '')
  const [frequency, setFrequency] = useState<SavingsCompoundingFrequency>('MONTHLY')
  const [rates, setRates] = useState<Record<SavingsOptionType, number>>(() => ({
    ...defaultRates,
    ...Object.fromEntries(goal.allocations.map((allocation) => [allocation.optionType, allocation.expectedAnnualReturnRate])),
  }))
  const holdings: PlannerHolding[] = goal.allocations.map((allocation) => ({
    balance: allocation.currentBalance,
    monthlyContribution: allocation.monthlyContribution,
    annualReturnRate: allocation.expectedAnnualReturnRate,
    compoundingFrequency: allocation.compoundingFrequency,
  }))
  const currentSavings = holdings.reduce((total, holding) => total + holding.balance, 0)
  const plannedMonthly = holdings.reduce((total, holding) => total + holding.monthlyContribution, 0)
  const targetMonths = monthsUntil(targetDate)
  const needed = targetDate && targetAmount > 0 && targetMonths > 0
  const currentPlanMonths = monthsToTarget(holdings, targetAmount)
  const fieldClass = 'h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]'

  function getMix(weights: Record<string, number>): PlannerMixOption[] {
    return Object.entries(weights).map(([optionType, share]) => ({
      optionType: optionType as SavingsOptionType,
      share,
      annualReturnRate: rates[optionType as SavingsOptionType],
      compoundingFrequency: frequency,
    }))
  }

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-medium" htmlFor="planner-target">Target amount<Input id="planner-target" type="number" min="0.01" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(Number(event.target.value))} /></label>
      <label className="space-y-2 text-sm font-medium" htmlFor="planner-date">Target date<Input id="planner-date" type="date" min={todayISODate()} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
    </div>

    <Card className="p-4 sm:p-5">
      <h4 className="font-semibold">Current plan estimate</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs text-[var(--secondary)]">Recorded in goal</p><p className="mt-1 font-semibold"><CurrencyAmount amount={currentSavings} /></p></div>
        <div><p className="text-xs text-[var(--secondary)]">Planned monthly contributions</p><p className="mt-1 font-semibold"><CurrencyAmount amount={plannedMonthly} /></p></div>
        <div><p className="text-xs text-[var(--secondary)]">Estimated time at current plan</p><p className="mt-1 font-semibold">{monthsLabel(currentPlanMonths)}</p></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--secondary)]">This uses recorded savings, each allocation’s current return assumption and its planned monthly contribution. A planned contribution is not counted in account balances until you record a transfer.</p>
    </Card>

    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h4 className="font-semibold">Compare illustrative mixes</h4><p className="mt-1 text-xs text-[var(--secondary)]">Change assumptions to match the rates you want to explore.</p></div>
        <label className="w-full space-y-2 text-xs font-medium sm:w-44" htmlFor="planner-frequency">Compounding assumption
          <select id="planner-frequency" className={fieldClass} value={frequency} onChange={(event) => setFrequency(event.target.value as SavingsCompoundingFrequency)}>{frequencies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        </label>
      </div>
      <details className="group mt-4 rounded-lg border border-[var(--border)] sm:open:border-transparent">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">Investment rates (% p.a.)<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <div className="grid grid-cols-2 gap-3 px-3 pb-3 sm:grid-cols-3 xl:grid-cols-5">
          {optionTypes.map((optionType) => <label key={optionType} className="min-w-0 space-y-2 text-xs font-medium" htmlFor={`planner-rate-${optionType}`}>{optionLabels[optionType]}
            <Input id={`planner-rate-${optionType}`} type="number" min="0" max="100" step="0.1" value={rates[optionType]} onChange={(event) => setRates((current) => ({ ...current, [optionType]: Number(event.target.value) }))} />
          </label>)}
        </div>
      </details>
      {needed ? <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3">
        {PLANNER_MIXES.map((mix) => {
          const options = getMix(mix.weights)
          const monthlyAmount = requiredMonthlyContribution(holdings, targetAmount, options, targetMonths)
          return <div key={mix.id} className="w-[85%] shrink-0 snap-center rounded-lg border border-[var(--border)] p-4 sm:w-auto">
            <h5 className="font-semibold">{mix.label}</h5>
            <p className="mt-2 text-xs text-[var(--secondary)]">Required monthly amount by {targetDate} ({targetMonths} months)</p>
            <p className="mt-1 text-xl font-semibold"><CurrencyAmount amount={monthlyAmount} /><span className="ml-1 text-xs font-normal text-[var(--secondary)]">/ month</span></p>
            <ul className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 text-xs">
              {options.map((option) => <li key={option.optionType} className="flex justify-between gap-2"><span className="text-[var(--secondary)]">{optionLabels[option.optionType]} ({Math.round(option.share * 100)}%)</span><CurrencyAmount amount={monthlyAmount * option.share} className="font-medium" /></li>)}
            </ul>
          </div>
        })}
      </div> : <p className="mt-4 rounded-lg bg-[var(--muted)] p-3 text-sm text-[var(--secondary)]">Choose a future target date and a positive target amount to compare monthly plans.</p>}
      <p className="mt-4 text-xs leading-5 text-[var(--secondary)]">These mixes are examples, not personalized recommendations. Returns are user-editable assumptions, can vary or be negative, and are not guaranteed. Taxes, fees, lock-ins, inflation, and investment risk are not included. Estimated growth is not added to your accounts.</p>
    </Card>
  </div>
}