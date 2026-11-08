import { Fragment } from 'react'
import { formatCompactINR, formatINR } from '@/lib/money'

interface CurrencyAmountProps {
  amount: number
  className?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function CurrencyAmount({
  amount,
  className = '',
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
}: CurrencyAmountProps) {
  const fullValue = formatINR(amount, { minimumFractionDigits, maximumFractionDigits })
  const mobileValue = formatCompactINR(amount) ?? fullValue

  return (
    <span className={`tabular-nums ${className}`} aria-label={fullValue} title={fullValue}>
      <span className="sm:hidden">{renderGroupedAmount(mobileValue)}</span>
      <span className="hidden sm:inline">{renderGroupedAmount(fullValue)}</span>
    </span>
  )
}

function renderGroupedAmount(value: string) {
  return value.split(',').map((group, index) => <Fragment key={`${value}-${index}`}>{index > 0 ? <>,<wbr /></> : null}{group}</Fragment>)
}