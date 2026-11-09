const formatMoney = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const dateLabel = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })

export function formatDate(value: string): string {
  return dateLabel.format(new Date(value + 'T12:00:00'))
}

export function euros(cents: number): string {
  return formatMoney.format(cents / 100)
}

