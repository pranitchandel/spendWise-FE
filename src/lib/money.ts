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
export function formatINR(rupees: number, options?: { compact?: boolean }): string {
  if (!Number.isFinite(rupees)) return '₹0.00'
  if (options?.compact && Math.abs(rupees) >= 100000) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(rupees)
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
