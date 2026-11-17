/** Formats a price in the item's own currency, for the viewer's locale. */
/** Whole amounts drop the minor units (₹1,899, not ₹1,899.00); others keep them (£39.90). */
export function formatPrice(amount: number, currency: string, locale?: string): string {
  const whole = Number.isInteger(amount)
  return new Intl.NumberFormat(locale, { style: 'currency', currency, ...(whole && { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }).format(amount)
}

export type PriorityBand = 'Must have' | 'Would love' | 'Nice to have'

/** Maps a 1–10 priority to its band name (PRODUCT.md). */
export function priorityBand(priority: number): PriorityBand {
  if (!Number.isInteger(priority) || priority < 1 || priority > 10) {
    throw new RangeError(`Priority must be an integer from 1 to 10, got ${priority}`)
  }
  if (priority >= 9) return 'Must have'
  if (priority >= 6) return 'Would love'
  return 'Nice to have'
}
