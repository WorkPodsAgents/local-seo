import { DAY_MS, dateOf, isMissing } from '../business'
import { median } from '../reviews'
import { analyzeReviews } from '../reviews'
import type { ReviewAnalytics } from '../reviews'
import { localThreshold } from '../registry'
import type { AuditExtras, CheckFn, LocalFinding } from './finding'
import { finding, graded, unknown } from './finding'

const rating: CheckFn = (b) => {
  if (isMissing(b.rating)) return unknown('L19', 'The rating', b.rating.reason)
  if (!isMissing(b.reviewCount) && b.reviewCount === 0) {
    return finding('L19', 'not_applicable', 'The profile has no reviews yet.')
  }
  const status = graded(b.rating, localThreshold('L19', 'min'), localThreshold('L19', 'good'))
  return finding('L19', status, `Rated ${b.rating}.`)
}

const count: CheckFn = (b) => {
  if (isMissing(b.reviewCount)) return unknown('L20', 'The review count', b.reviewCount.reason)
  const status = graded(b.reviewCount, localThreshold('L20', 'min'), localThreshold('L20', 'good'))
  return finding('L20', status, `${b.reviewCount} reviews.`)
}

const againstCompetitors: CheckFn = (b, extras) => {
  if (isMissing(b.reviewCount)) return unknown('L21', 'The review count', b.reviewCount.reason)
  const counts = (extras.competitors ?? [])
    .filter((row) => !row.sponsored && row.name !== b.name)
    .flatMap((row) => (row.reviewCount === null ? [] : [row.reviewCount]))
  const middle = median(counts)
  if (middle === null || middle === 0) {
    return finding('L21', 'not_applicable', 'No competitor review counts were read.')
  }
  const ratio = b.reviewCount / middle
  const status = graded(
    ratio,
    localThreshold('L21', 'min_ratio'),
    localThreshold('L21', 'good_ratio'),
  )
  const summary = `${b.reviewCount} reviews against a competitor median of ${middle}.`
  return finding('L21', status, summary, [{ note: `median of ${counts.length} competitors` }])
}

/** Review checks that need the reviews themselves; one analysis serves them all. */
function withReviews(
  checkId: string,
  judge: (analytics: ReviewAnalytics, extras: AuditExtras) => LocalFinding,
): CheckFn {
  return (_b, extras) => {
    if (extras.reviews === undefined) {
      return finding(checkId, 'not_applicable', 'The reviews were not read.')
    }
    if (extras.reviews.length === 0) {
      return finding(checkId, 'not_applicable', 'The profile has no reviews to judge.')
    }
    return judge(analyzeReviews(extras.reviews, extras.now), extras)
  }
}

const recent = withReviews('L22', (analytics, extras) => {
  if (extras.reviewsSample !== undefined) {
    return finding('L22', 'not_applicable', extras.reviewsSample)
  }
  if (analytics.velocity === null) {
    return finding('L22', 'not_applicable', 'No review read carries a date.')
  }
  const last90 = analytics.velocity.last90
  const status = graded(last90, localThreshold('L22', 'min_90d'), localThreshold('L22', 'good_90d'))
  return finding('L22', status, `${last90} reviews in the last 90 days among those read.`)
})

const replied = withReviews('L23', (analytics) => {
  const { rate, replied: count, total } = analytics.responses
  if (rate === null) return finding('L23', 'not_applicable', 'No reviews were read.')
  const status = graded(rate, localThreshold('L23', 'min'), localThreshold('L23', 'good'))
  return finding('L23', status, `The owner replied to ${count} of ${total} reviews read.`)
})

const quick = withReviews('L24', (analytics, extras) => {
  if (extras.reviewsSample !== undefined) {
    return finding('L24', 'not_applicable', extras.reviewsSample)
  }
  const days = analytics.responses.medianReplyDays
  if (days === null) {
    return finding('L24', 'not_applicable', 'No reply with both dates known was read.')
  }
  const good = localThreshold('L24', 'good_days')
  const max = localThreshold('L24', 'max_days')
  const status = days <= good ? 'pass' : days <= max ? 'partial' : 'fail'
  const summary = `The median reply comes ${days} days after the review.`
  return finding('L24', status, summary, [
    { note: `from ${analytics.responses.timedReplies} replies` },
  ])
})

const negativesAnswered: CheckFn = (_b, extras) => {
  if (extras.reviews === undefined) {
    return finding('L25', 'not_applicable', 'The reviews were not read.')
  }
  const maxRating = localThreshold('L25', 'max_rating')
  const window = localThreshold('L25', 'window_days') * DAY_MS
  const open = extras.reviews.filter((review) => {
    if (review.ownerReply !== null || review.rating > maxRating) return false
    const date = dateOf(review, extras.now)
    // An undated negative review may be recent; it counts rather than hides.
    return date === null || extras.now.getTime() - date.getTime() <= window
  })
  if (open.length === 0) {
    // A sample can miss the recent negatives, so finding none there proves nothing.
    if (extras.reviewsSample !== undefined) {
      return finding('L25', 'not_applicable', extras.reviewsSample)
    }
    return finding('L25', 'pass', 'Every recent negative review read has a reply.')
  }
  const evidence = open.slice(0, 5).map((review) => ({
    value: (review.text ?? '(no text)').slice(0, 120),
    note: `${review.rating} stars, ${review.publishedAt ?? review.relativeAge ?? 'undated'}`,
  }))
  return finding('L25', 'fail', `${open.length} negative reviews have no reply.`, evidence)
}

export const REVIEWS: readonly CheckFn[] = [
  rating,
  count,
  againstCompetitors,
  recent,
  replied,
  quick,
  negativesAnswered,
]
