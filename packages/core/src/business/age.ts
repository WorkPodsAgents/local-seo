// Maps shows review and post dates as "3 weeks ago". Resolving them against the moment the page
// was read gives an approximate date, good enough for velocity and cadence by month.

const UNIT_MS: Readonly<Record<string, number>> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
}

const PATTERN = /^(?:edited\s+)?(a|an|one|\d+)\s+(minute|hour|day|week|month|year)s?\s+ago$/i

/**
 * The ISO date an English relative age points to, counted back from `now`; null for anything
 * else, including other languages, so a guess never passes for a date.
 */
export function resolveRelativeAge(age: string, now: Date): string | null {
  const match = PATTERN.exec(age.trim().replace(/\s+/g, ' '))
  if (match === null) return null
  const [, amountText = '', unitText = ''] = match
  const amount = /^\d+$/.test(amountText) ? Number(amountText) : 1
  const unit = unitText.toLowerCase()
  const months = unit === 'month' ? amount : unit === 'year' ? 12 * amount : 0
  const at =
    months > 0 ? monthsBefore(now, months) : new Date(now.getTime() - amount * (UNIT_MS[unit] ?? 0))
  return at.toISOString().slice(0, 10)
}

/** `months` calendar months back, on the same day or the target month's last day when shorter. */
function monthsBefore(now: Date, months: number): Date {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() - months
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(now.getUTCDate(), lastDay)))
}

/** A dated item's date: the exact one when known, else its resolved relative age. */
export function dateOf(
  item: { readonly publishedAt: string | null; readonly relativeAge: string | null },
  now: Date,
): Date | null {
  if (item.publishedAt !== null) {
    const exact = new Date(item.publishedAt)
    if (!Number.isNaN(exact.getTime())) return exact
  }
  if (item.relativeAge === null) return null
  const resolved = resolveRelativeAge(item.relativeAge, now)
  return resolved === null ? null : new Date(resolved)
}

export const DAY_MS = 86_400_000

/** Whole days from `from` to `to`, never negative. */
export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS))
}

/** "2026-03", the month a date falls in, UTC. */
export function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7)
}
