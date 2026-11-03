import type { ReadPostsResult } from '@local-seo/core/bridge'
import type { PostAnalytics } from '@local-seo/core/posts'
import type { PaidRequest } from '../../shared/api'
import type { BusinessView } from '../../shared/local'
import { call } from '../client'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { ErrorNote, Note } from '../components/notice'
import { PaidAction } from '../components/paid-action'
import { Kpi, Kpis, percent, refOf } from '../parts'
import styles from '../screens/screens.module.css'
import { useTask } from '../use-task'

interface PostsRead {
  readonly analytics: PostAnalytics
  /** Why how often the owner posts is unknown; null when every post was read. */
  readonly unknown: string | null
}

/** How often the owner posts, the silences between posts, and what posts carry. */
export function PostsCard({ view }: { readonly view: BusinessView }) {
  const initial: PostsRead | null =
    view.posts === null ? null : { analytics: view.posts.analytics, unknown: view.posts.unknown }
  const read = useTask<PostsRead>(initial)
  const business = refOf(view.business)
  const runWith = (load: () => Promise<ReadPostsResult>) => () =>
    void read.run(async () => {
      const result = await load()
      return { analytics: result.analytics, unknown: result.unknown }
    })
  const runFree = runWith(() => call('local:read_posts', { business }))
  const runPaid = runWith(async () => (await call('paid:read_posts', { business })).data)
  const request: PaidRequest = { op: 'paid:read_posts', args: { business } }
  const running = read.task.kind === 'running'
  const value = read.value
  const a = value?.analytics ?? null
  return (
    <Card
      title="Posts"
      subtitle={
        a === null
          ? 'Read the posts to see how often the owner posts.'
          : value?.unknown != null
            ? a.count === 0
              ? 'Posts are unknown.'
              : 'Only the newest post was read.'
            : a.count === 0
              ? 'The profile has no posts.'
              : `${a.count} posts read`
      }
    >
      <div className={styles.row}>
        <Button busy={running} onClick={runFree}>
          Newest post, free
        </Button>
        <PaidAction request={request} label="All posts" busy={running} onRun={runPaid} />
      </div>
      {read.task.kind === 'failed' ? <ErrorNote>{read.task.error}</ErrorNote> : null}
      {value?.unknown == null ? null : <Note>{value.unknown}</Note>}
      {a === null || a.count === 0 || value?.unknown == null ? null : (
        <Kpis pairs>
          <Kpi
            label="Newest post"
            value={a.lastPostAgeDays === null ? null : `${a.lastPostAgeDays} d ago`}
            unknown="Undated"
          />
        </Kpis>
      )}
      {a === null || a.count === 0 || value?.unknown != null ? null : (
        <>
          <Kpis pairs>
            <Kpi
              label="Last post"
              value={a.lastPostAgeDays === null ? null : `${a.lastPostAgeDays} d ago`}
              unknown="No dated post"
            />
            <Kpi
              label="Last 90 days"
              value={a.last90 === null ? null : String(a.last90)}
              unknown="No dated post"
            />
            <Kpi
              label="Typical gap"
              value={a.medianIntervalDays === null ? null : `${a.medianIntervalDays} d`}
              unknown="Needs 2 dated posts"
            />
            <Kpi label="With a photo" value={percent(a.mediaShare)} />
          </Kpis>
          <Timeline analytics={a} />
          {a.gaps.length === 0 ? null : (
            <ul className={styles.list} aria-label="Silences longer than 30 days">
              {a.gaps.slice(0, 4).map((gap) => (
                <li key={gap.from} className={styles.spread}>
                  <span className={styles.muted}>
                    {gap.from} to {gap.to}
                  </span>
                  <span className={styles.numeric}>{gap.days} days silent</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

/** One mark per month from the first post to now; an empty month is a visible gap. */
function Timeline({ analytics }: { readonly analytics: PostAnalytics }) {
  if (analytics.timeline.length === 0) {
    return <Note>No post carries a date Maps showed, so there is no timeline.</Note>
  }
  const max = Math.max(...analytics.timeline.map((month) => month.count))
  return (
    <ul className={styles.list} aria-label="Posts per month">
      {analytics.timeline.map((month) => (
        <li key={month.month} className={styles.freqRow}>
          <span>{month.month}</span>
          <span className={styles.freqTrack} aria-hidden="true">
            <span className={styles.freqFill} style={{ width: `${(month.count / max) * 100}%` }} />
          </span>
          <span className={`${styles.numeric} ${styles.muted}`}>{month.count}</span>
        </li>
      ))}
    </ul>
  )
}
