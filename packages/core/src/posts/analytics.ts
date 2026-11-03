// Post analytics: how often the owner posts, how long they go silent, and what posts carry.
import type { Post } from '../business'
import { DAY_MS, daysBetween, dateOf, monthOf } from '../business'
import { median, share } from '../reviews'

export interface PostMonth {
  readonly month: string
  readonly count: number
}

export interface PostGap {
  /** ISO dates of the posts either side of the silence. */
  readonly from: string
  readonly to: string
  readonly days: number
}

export interface PostAnalytics {
  readonly count: number
  readonly undated: number
  /** Oldest month first; only months with posts. */
  readonly timeline: readonly PostMonth[]
  /** Days since the newest post; null when no post has a date. */
  readonly lastPostAgeDays: number | null
  /** Posts in the last 30 and 90 days; null when no post has a date. */
  readonly last30: number | null
  readonly last90: number | null
  /** Median days between consecutive posts; null with fewer than two dated posts. */
  readonly medianIntervalDays: number | null
  /** Silences longer than `gapDays` between posts, and since the last post, longest first. */
  readonly gaps: readonly PostGap[]
  /** Shares 0..1; null when there are no posts. */
  readonly mediaShare: number | null
  readonly linkShare: number | null
  readonly length: { readonly min: number; readonly median: number; readonly max: number } | null
  readonly kinds: Readonly<Record<Post['kind'], number>>
}

export function analyzePosts(posts: readonly Post[], now: Date, gapDays = 30): PostAnalytics {
  const dates = posts
    .map((post) => dateOf(post, now))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())
  const newest = dates.at(-1)
  const within = (days: number) =>
    dates.length === 0
      ? null
      : dates.filter((date) => now.getTime() - date.getTime() <= days * DAY_MS).length
  const lengths = posts.map((post) => post.text.length)
  return {
    count: posts.length,
    undated: posts.length - dates.length,
    timeline: timeline(dates),
    lastPostAgeDays: newest === undefined ? null : daysBetween(newest, now),
    last30: within(30),
    last90: within(90),
    medianIntervalDays: median(intervals(dates)),
    gaps: gaps(dates, now, gapDays),
    mediaShare: share(posts.filter((post) => post.hasMedia).length, posts.length),
    linkShare: share(posts.filter((post) => post.link !== null).length, posts.length),
    length:
      lengths.length === 0
        ? null
        : { min: Math.min(...lengths), median: median(lengths) ?? 0, max: Math.max(...lengths) },
    kinds: {
      update: posts.filter((post) => post.kind === 'update').length,
      offer: posts.filter((post) => post.kind === 'offer').length,
      event: posts.filter((post) => post.kind === 'event').length,
      unknown: posts.filter((post) => post.kind === 'unknown').length,
    },
  }
}

function timeline(dates: readonly Date[]): PostMonth[] {
  const months = new Map<string, number>()
  for (const date of dates) months.set(monthOf(date), (months.get(monthOf(date)) ?? 0) + 1)
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }))
}

function intervals(dates: readonly Date[]): number[] {
  return dates.slice(1).map((date, at) => daysBetween(dates[at] ?? date, date))
}

function gaps(dates: readonly Date[], now: Date, gapDays: number): PostGap[] {
  const ends = [...dates, now]
  const found: PostGap[] = []
  for (let at = 1; at < ends.length && dates.length > 0; at += 1) {
    const from = ends[at - 1]
    const to = ends[at]
    if (from === undefined || to === undefined) continue
    const days = daysBetween(from, to)
    if (days > gapDays) found.push({ from: isoDay(from), to: isoDay(to), days })
  }
  return found.sort((a, b) => b.days - a.days)
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}
