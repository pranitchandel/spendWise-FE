import { describe, expect, it } from 'vitest'
import { formatCompactINR, formatINR } from './money'

describe('INR formatting', () => {
  it('preserves all amount digits instead of abbreviating thousands or lakhs', () => {
    expect(formatINR(116000, { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe('₹1,16,000')
  })

  it('abbreviates only when the compact value preserves the exact amount', () => {
    expect(formatCompactINR(156000)).toBe('₹1.56L')
    expect(formatINR(145678)).toBe('₹1,45,678.00')
    expect(formatCompactINR(145678)).toBeNull()
  })

  it('clamps the minimum fraction digits to the configured maximum', () => {
    expect(() => formatINR(80000, { minimumFractionDigits: 2, maximumFractionDigits: 0 })).not.toThrow()
  })
})
