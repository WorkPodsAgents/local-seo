import { LIMITS } from '@local-seo/core/bridge'
import type { Business, Review } from '@local-seo/core/business'
import type { ReviewAnalytics, UnansweredReview } from '@local-seo/core/reviews'
import { useState } from 'react'
import type { PaidRequest } from '../../shared/api'
import type { BusinessView } from '../../shared/local'
import { DraftBox } from '../business/draft-box'
import { MonthlyRating, MonthlyReviews, StarDistribution } from '../charts/review-charts'
import { call } from '../client'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { ErrorNote, Note } from '../components/notice'
import { PaidAction } from '../components/paid-action'
import { count, Kpi, Kpis, known, percent, refOf, Segmented } from '../parts'
import styles from '../screens/screens.module.css'
import { useTask } from '../use-task'
import { PostsCard } from './posts-card'

interface ReviewsRead {
  readonly reviews: readonly Review[]
  readonly analytics: ReviewAnalytics
  /** Why the list ended short, when it did; null when it is complete. */
  readonly shortBy: string | null
  readonly source: 'browser' | 'dataforseo'
}

type Source = ReviewsRead['source']

/** The newest few; the rest open on request so the posts stay in reach. */
const NEGATIVES_SHOWN = 4

/** How the business earns and answers its reviews, and how often it posts. */
export function ReviewsScreen({ view }: { readonly view: BusinessView }) {
  const business = view.business
  const [source, setSource] = useState<Source>('browser')
  const [depth, setDepth] = useState(100)
  const fromAudit: ReviewsRead | null =
    view.reviews === null
      ? null
      : {
          reviews: view.reviews.items,
          analytics: view.reviews.analytics,
          shortBy: shortBy(business, view.reviews.items.length, view.reviews.stoppedBy),
          source: 'browser',
        }
  const read = useTask<ReviewsRead>(fromAudit)
  const args = { business: refOf(business), max: depth }
  const run = () =>
    void read.run(async () => {
      const result =
        source === 'browser'
          ? await call('local:read_reviews', args)
          : (await call('paid:read_reviews', args)).data
      return {
        reviews: result.reviews,
        analytics: result.analytics,
        shortBy: result.truncated ? `Read ${result.read} of the profile's reviews.` : null,
        source,
      }
    })
  const request: PaidRequest = { op: 'paid:read_reviews', args }
  const value = read.value
  const running = read.task.kind === 'running'
  return (
    <div className={styles.stack}>
      <Card
        title="Reviews"
        subtitle={
          value === null
            ? 'Read the reviews to see trends, replies and themes.'
            : `${value.analytics.count} reviews read` +
              (value.source === 'dataforseo' ? ' from DataForSEO' : '')
        }
      >
        <Segmented
          label="Where to read reviews"
          value={source}
          onChange={setSource}
          options={[
            { id: 'browser', label: 'Free, from Maps' },
            { id: 'dataforseo', label: 'DataForSEO, full history' },
          ]}
        />
        {source === 'dataforseo' ? (
          <Segmented
            label="How many reviews"
            value={String(depth)}
            onChange={(next) => setDepth(Number(next))}
            options={[100, 250, LIMITS.reviews.max].map((n) => ({ id: String(n), label: `${n}` }))}
          />
        ) : null}
        <div className={styles.row}>
          {source === 'browser' ? (
            <Button variant={value === null ? 'primary' : 'secondary'} busy={running} onClick={run}>
              {running ? 'Reading reviews' : value === null ? 'Read reviews' : 'Read again'}
            </Button>
          ) : (
            <PaidAction request={request} label="Read reviews" busy={running} onRun={run} />
          )}
        </div>
        {value?.shortBy == null ? null : <Note>{value.shortBy}</Note>}
        {read.task.kind === 'failed' ? <ErrorNote>{read.task.error}</ErrorNote> : null}
        {value === null ? null : <ReviewKpis business={business} analytics={value.analytics} />}
      </Card>
      {value === null || value.analytics.count === 0 ? null : (
        <>
          <TrendCard analytics={value.analytics} />
          <ThemesCard analytics={value.analytics} />
          <NegativesCard business={business} read={value} />
        </>
      )}
      <PostsCard view={view} />
    </div>
  )
}

function shortBy(business: Business, read: number, stoppedBy: string): string | null {
  const total = known(business.reviewCount)
  if (stoppedBy === 'limited_view') {
    return (
      `Signed out of Google, Maps showed ${read} of ${count(total) ?? 'its'} reviews. Sign in ` +
      'to Google in this browser, or read the full history from DataForSEO.'
    )
  }
  if (total !== null && total > read) return `Read ${read} of ${count(total)} reviews.`
  return null
}

function ReviewKpis({
  business,
  analytics,
}: {
  readonly business: Business
  readonly analytics: ReviewAnalytics
}) {
  const responses = analytics.responses
  return (
    <Kpis pairs>
      <Kpi
        label="Profile rating"
        value={known(business.rating)?.toFixed(1) ?? null}
        note={`${count(known(business.reviewCount)) ?? 'Unknown'} reviews in all`}
      />
      <Kpi
        label="Last 90 days"
        value={analytics.velocity === null ? null : String(analytics.velocity.last90)}
        unknown="No dated reviews"
        note={analytics.velocity === null ? undefined : `${analytics.velocity.last30} in 30 days`}
      />
      <Kpi
        label="Reply rate"
        value={percent(responses.rate)}
        unknown="No reviews"
        note={`${responses.replied} of ${responses.total} answered`}
      />
      <Kpi
        label="Reply time"
        value={responses.medianReplyDays === null ? null : `${responses.medianReplyDays} d`}
        unknown="No dated replies"
        note={
          responses.timedReplies === 0
            ? 'Maps hides reply dates'
            : `median of ${responses.timedReplies}`
        }
      />
    </Kpis>
  )
}

function TrendCard({ analytics }: { readonly analytics: ReviewAnalytics }) {
  return (
    <Card
      title="Trend"
      subtitle={
        analytics.undated === 0
          ? 'Reviews and average rating per month.'
          : `Per month; ${analytics.undated} reviews without a readable date are left out.`
      }
    >
      {analytics.monthly.length === 0 ? (
        <Note>No review carries a date Maps showed, so there is no trend.</Note>
      ) : (
        <>
          <span className={styles.sectionTitle}>Reviews per month</span>
          <MonthlyReviews monthly={analytics.monthly} />
          <span className={styles.sectionTitle}>Average rating per month</span>
          <MonthlyRating monthly={analytics.monthly} />
        </>
      )}
      <span className={styles.sectionTitle}>By star</span>
      <StarDistribution distribution={analytics.distribution} />
    </Card>
  )
}

function ThemesCard({ analytics }: { readonly analytics: ReviewAnalytics }) {
  if (analytics.themes.length === 0) return null
  return (
    <Card title="What reviewers mention" subtitle="Words and phrases that recur across reviews.">
      <div className={styles.chips}>
        {analytics.themes.map((theme) => (
          <span key={theme.phrase} className={styles.chip}>
            {theme.phrase} <span className={styles.muted}>&nbsp;{theme.count}</span>
          </span>
        ))}
      </div>
    </Card>
  )
}

function NegativesCard({
  business,
  read,
}: {
  readonly business: Business
  readonly read: ReviewsRead
}) {
  const [drafting, setDrafting] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const unanswered = read.analytics.unansweredNegatives
  const negatives = all ? unanswered : unanswered.slice(0, NEGATIVES_SHOWN)
  return (
    <Card
      title="Unanswered negative reviews"
      subtitle={
        unanswered.length === 0
          ? 'Every 1 and 2 star review read has a reply.'
          : `${unanswered.length} with no reply, newest first. A calm reply helps the next reader.`
      }
    >
      {negatives.map((negative, at) => {
        const key = negative.id ?? `n${at}`
        return (
          <div key={key} className={styles.verdict}>
            <div className={styles.spread}>
              <Badge tone="bad">{negative.rating} star</Badge>
              <span className={styles.muted}>{negative.date ?? 'Date not shown'}</span>
            </div>
            <p className={styles.quote}>{negative.excerpt ?? 'A rating without text.'}</p>
            {drafting === key ? (
              <DraftBox
                kind="review_reply"
                business={business}
                review={reviewOf(negative, read.reviews)}
                label="Draft a reply"
              />
            ) : (
              <div>
                <Button variant="ghost" onClick={() => setDrafting(key)}>
                  Draft a reply
                </Button>
              </div>
            )}
          </div>
        )
      })}
      {negatives.length < unanswered.length ? (
        <div>
          <Button variant="ghost" onClick={() => setAll(true)}>
            Show all {unanswered.length}
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

/** The full review when it was read, else one rebuilt from the excerpt the analytics kept. */
function reviewOf(negative: UnansweredReview, reviews: readonly Review[]): Review {
  const found = reviews.find((review) => negative.id !== null && review.id === negative.id)
  return (
    found ?? {
      id: negative.id,
      rating: negative.rating,
      text: negative.excerpt,
      publishedAt: negative.date,
      relativeAge: null,
      ownerReply: null,
      authorReviewCount: null,
      photoCount: 0,
    }
  )
}
