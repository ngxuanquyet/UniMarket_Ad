export function toMoney(amount: number | null): string {
  if (amount == null) return '--'
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

export function formatDateTime(millis: number): string {
  if (millis <= 0) return 'Unknown'
  return new Date(millis).toLocaleString()
}
