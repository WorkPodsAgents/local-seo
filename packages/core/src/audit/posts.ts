import { analyzePosts } from '../posts'
import type { PostAnalytics } from '../posts'
import { localThreshold } from '../registry'
import type { CheckFn, LocalFinding } from './finding'
import { finding, graded } from './finding'

/** Post checks need the posts read; an empty list read means the profile has none. */
function withPosts(checkId: string, judge: (analytics: PostAnalytics) => LocalFinding): CheckFn {
  return (_b, extras) => {
    if (extras.postsUnknown !== undefined) {
      return finding(checkId, 'not_applicable', extras.postsUnknown)
    }
    if (extras.posts === undefined) {
      return finding(checkId, 'not_applicable', 'The posts were not read.')
    }
    return judge(analyzePosts(extras.posts, extras.now))
  }
}

const recent = withPosts('L26', (analytics) => {
  if (analytics.count === 0) return finding('L26', 'fail', 'The profile has no posts.')
  const age = analytics.lastPostAgeDays
  if (age === null) return finding('L26', 'not_applicable', 'No post read carries a date.')
  const good = localThreshold('L26', 'good_days')
  const max = localThreshold('L26', 'max_days')
  const status = age <= good ? 'pass' : age <= max ? 'partial' : 'fail'
  return finding('L26', status, `The latest post is ${age} days old.`)
})

const cadence = withPosts('L27', (analytics) => {
  if (analytics.count === 0) return finding('L27', 'fail', 'The profile has no posts.')
  if (analytics.last90 === null) {
    return finding('L27', 'not_applicable', 'No post read carries a date.')
  }
  const min = localThreshold('L27', 'min_90d')
  const good = localThreshold('L27', 'good_90d')
  const evidence = analytics.gaps.slice(0, 3).map((gap) => ({
    value: `${gap.from} to ${gap.to}`,
    note: `${gap.days} days without a post`,
  }))
  const summary = `${analytics.last90} posts in the last 90 days.`
  return finding('L27', graded(analytics.last90, min, good), summary, evidence)
})

function shareCheck(
  checkId: string,
  pick: (analytics: PostAnalytics) => number | null,
  what: string,
): CheckFn {
  return withPosts(checkId, (analytics) => {
    const share = pick(analytics)
    if (share === null) return finding(checkId, 'not_applicable', 'There are no posts to judge.')
    const status = graded(share, Number.MIN_VALUE, localThreshold(checkId, 'share'))
    return finding(checkId, status, `${Math.round(share * 100)}% of posts ${what}.`)
  })
}

const links = shareCheck('L28', (analytics) => analytics.linkShare, 'carry a link')
const media = shareCheck('L29', (analytics) => analytics.mediaShare, 'carry a photo or video')

export const POSTS: readonly CheckFn[] = [recent, cadence, links, media]
