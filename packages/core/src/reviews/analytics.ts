// Review analytics over what a reader or DataForSEO returned. Every rate says how many reviews
// it rests on, and a figure no review can support is null, never 0.
import type { Review } from '../business'
import { DAY_MS, dateOf, monthOf } from '../business'
import type { Theme } from './themes'
import { reviewThemes } from './themes'

export interface MonthTrend {
  /** "2026-03" */
  readonly month: string
  readonly count: number
  readonly averageRating: number
}

export interface Velocity {
  readonly last30: number
  readonly last90: number
  readonly last365: number
}

export interface Responses {
  readonly replied: number
  readonly total: number
  /** Share of reviews with an owner reply, 0..1; null when there are no reviews. */
  readonly rate: number | null
  /** Median days from review to reply; null when no reply has both dates. */
  readonly medianReplyDays: number | null
  /** Replies the median rests on. */
  readonly timedReplies: number
}

export interface UnansweredReview {
  readonly id: string | null
  readonly rating: number
  /** ISO date, null when neither a date nor a readable age was shown. */
  readonly date: string | null
  readonly excerpt: string | null
}

export interface ReviewAnalytics {
  readonly count: number
  /** Mean of the reviews read, which can differ from the profile's overall rating. */
  readonly averageRating: number | null
  /** Reviews per star, index 0 is one star. */
  readonly distribution: readonly [number, number, number, number, number]
  /** Oldest month first; only months with reviews. */
  readonly monthly: readonly MonthTrend[]
  /** Null when no review carries a date or a readable age. */
  readonly velocity: Velocity | null
  /** Reviews whose date could not be told; velocity and trend leave them out. */
  readonly undated: number
  readonly responses: Responses
  /** Negative reviews (rating at or below `negativeAtMost`) with no owner reply, newest first. */
  readonly unansweredNegatives: readonly UnansweredReview[]
  /** Share of reviews with a photo, 0..1; null when there are no reviews. */
  readonly photoShare: number | null
  readonly themes: readonly Theme[]
}

export interface ReviewOptions {
  readonly negativeAtMost?: number
  readonly themes?: number
}

const EXCERPT = 160

export function analyzeReviews(
  reviews: readonly Review[],
  now: Date,
  options: ReviewOptions = {},
): ReviewAnalytics {
  const negativeAtMost = options.negativeAtMost ?? 2
  const dated = reviews.map((review) => ({ review, date: dateOf(review, now) }))
  const withDates = dated.filter((entry): entry is { review: Review; date: Date } => !!entry.date)
  return {
    count: reviews.length,
    averageRating: mean(reviews.map((review) => review.rating)),
    distribution: distribution(reviews),
    monthly: monthly(withDates),
    velocity: withDates.length === 0 ? null : velocity(withDates, now),
    undated: reviews.length - withDates.length,
    responses: responses(dated, now),
    unansweredNegatives: dated
      .filter(({ review }) => review.ownerReply === null && review.rating <= negativeAtMost)
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
      .map(({ review, date }) => ({
        id: review.id,
        rating: review.rating,
        date: date === null ? null : date.toISOString().slice(0, 10),
        excerpt: review.text === null ? null : review.text.slice(0, EXCERPT),
      })),
    photoShare: share(reviews.filter((review) => review.photoCount > 0).length, reviews.length),
    themes: reviewThemes(reviews, options.themes),
  }
}

function distribution(reviews: readonly Review[]): [number, number, number, number, number] {
  const stars = reviews.map((review) => Math.min(5, Math.max(1, Math.round(review.rating))))
  const count = (star: number) => stars.filter((entry) => entry === star).length
  return [count(1), count(2), count(3), count(4), count(5)]
}

function monthly(dated: readonly { review: Review; date: Date }[]): MonthTrend[] {
  const months = new Map<string, number[]>()
  for (const { review, date } of dated) {
    const key = monthOf(date)
    months.set(key, [...(months.get(key) ?? []), review.rating])
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, ratings]) => ({
      month,
      count: ratings.length,
      averageRating: mean(ratings) ?? 0,
    }))
}

function velocity(dated: readonly { date: Date }[], now: Date): Velocity {
  const within = (days: number) =>
    dated.filter(({ date }) => now.getTime() - date.getTime() <= days * DAY_MS).length
  return { last30: within(30), last90: within(90), last365: within(365) }
}

function responses(dated: readonly { review: Review; date: Date | null }[], now: Date): Responses {
  const replied = dated.filter(({ review }) => review.ownerReply !== null)
  const delays: number[] = []
  for (const { review, date } of replied) {
    const reply = review.ownerReply
    if (reply === null || date === null) continue
    const replyDate = dateOf({ publishedAt: reply.publishedAt, relativeAge: null }, now)
    if (replyDate === null) continue
    delays.push(Math.max(0, (replyDate.getTime() - date.getTime()) / DAY_MS))
  }
  return {
    replied: replied.length,
    total: dated.length,
    rate: share(replied.length, dated.length),
    medianReplyDays: median(delays),
    timedReplies: delays.length,
  }
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const value =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
  return round2(value)
}

export function share(part: number, whole: number): number | null {
  return whole === 0 ? null : round2(part / whole)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
