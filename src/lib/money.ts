const PAISE_PER_RUPEE = 100

/** Convert rupees to integer paise (half-up). Forms use rupees. */
export function toPaise(rupees: number | string): number {
  const n = typeof rupees === 'string' ? Number.parseFloat(rupees) : rupees
  if (!Number.isFinite(n)) return 0
  return Math.round(n * PAISE_PER_RUPEE)
}

/** Convert integer paise to rupees. */
export function toRupees(paise: number): number {
  return Math.round(paise) / PAISE_PER_RUPEE
}

/** Format a rupee amount as INR. */
export function formatINR(rupees: number, options?: {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}): string {
  if (!Number.isFinite(rupees)) return '₹0.00'
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2
  const minimumFractionDigits = Math.min(options?.minimumFractionDigits ?? 2, maximumFractionDigits)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(rupees)
}

/** Return compact INR only when its displayed precision preserves the exact amount. */
export function formatCompactINR(rupees: number, maximumFractionDigits = 2): string | null {
  if (!Number.isFinite(rupees) || Math.abs(rupees) < 10000) return null

  const absoluteAmount = Math.abs(rupees)
  const compactScale = absoluteAmount >= 10000000 ? 10000000 : absoluteAmount >= 100000 ? 100000 : 1000
  const compactPrecision = 10 ** maximumFractionDigits
  const roundedCompactUnits = Math.round((absoluteAmount / compactScale) * compactPrecision) / compactPrecision
  if (Math.round(roundedCompactUnits * compactScale * 100) !== Math.round(absoluteAmount * 100)) return null

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(rupees)
}

/** Format paise as INR (when API returns paise). */
export function formatPaise(paise: number): string {
  return formatINR(toRupees(paise))
}

export function parseRupeeInput(value: string): number {
  const cleaned = value.replace(/[₹,\s]/g, '')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

export function signedAmount(type: string, amount: number): number {
  switch (type) {
    case 'INCOME':
    case 'BORROWING':
    case 'LENDING_REPAYMENT':
    case 'REFUND':
      return amount
    case 'EXPENSE':
    case 'LENDING':
    case 'BORROWING_REPAYMENT':
      return -amount
    default:
      return 0
  }
}
