// A full profile audit: the profile, then whatever else was asked for (reviews, posts, the
// website, the competitors), each read on its own so one that fails becomes a note, never a
// failed audit. A part not read leaves its checks not_applicable.
import { auditProfile, type AuditExtras } from '@local-seo/core/audit'
import {
  DEFAULT_AUDIT_PARTS,
  LIMITS,
  type AuditPart,
  type AuditProfileResult,
} from '@local-seo/core/bridge'
import type { Business, Post, Review } from '@local-seo/core/business'
import { isMissing } from '@local-seo/core/business'
import { scanTable, type ScanRow } from '@local-seo/core/compare'
import type { WebsiteCheck } from '@local-seo/core/nap'
import { analyzePosts, type PostAnalytics } from '@local-seo/core/posts'
import { profileReport, reportMarkdown } from '@local-seo/core/report'
import { analyzeReviews, type ReviewAnalytics } from '@local-seo/core/reviews'
import type { ListStop } from '../readers/paging'
import type { LocalDeps } from './deps'
import {
  overviewNote,
  postsUnknown,
  readPlacePosts,
  readPlaceReviews,
  readResults,
  sampleNote,
} from './reads'

export interface ReviewsSeen {
  readonly items: readonly Review[]
  readonly analytics: ReviewAnalytics
  readonly stoppedBy: ListStop
  /** False when Maps kept its "Most relevant" order. */
  readonly newestFirst: boolean
}

export interface PostsSeen {
  readonly items: readonly Post[]
  readonly analytics: PostAnalytics
  readonly stoppedBy: ListStop
  /** Why how often the owner posts is unknown; the browser never reads every post. */
  readonly unknown: string
}

/** The audit with everything read for it, which the panel shows beyond the tool's result. */
export interface FullAudit extends AuditProfileResult {
  readonly keyword: string | null
  readonly reviews: ReviewsSeen | null
  readonly posts: PostsSeen | null
  readonly website: WebsiteCheck | null
  readonly competitors: readonly ScanRow[] | null
}

const LIMITED =
  'Signed out of Google, Maps shows only a few reviews; sign in to Google in this browser to ' +
  'read them all.'

export async function auditBusiness(
  deps: LocalDeps,
  business: Business,
  include: readonly AuditPart[] = DEFAULT_AUDIT_PARTS,
  keyword: string | null = null,
  /** Why fields may be missing because Maps was not in English; null when it was. */
  languageNote: string | null = null,
): Promise<FullAudit> {
  const now = deps.now()
  const notes: string[] = languageNote === null ? [] : [languageNote]
  const attempt = async <T>(what: string, read: () => Promise<T>): Promise<T | null> => {
    try {
      return await read()
    } catch (error) {
      notes.push(`${what} were not read: ${error instanceof Error ? error.message : error}`)
      return null
    }
  }

  const reviews = !include.includes('reviews')
    ? null
    : await attempt('Reviews', async () => {
        const read = await deps.maps((page) =>
          readPlaceReviews(page, business, LIMITS.reviews.default),
        )
        const overview = overviewNote(read)
        if (overview !== null) notes.push(overview)
        const sample = sampleNote(read)
        if (sample !== null) notes.push(sample)
        if (read.stoppedBy === 'limited_view') notes.push(LIMITED)
        return { ...read, analytics: analyzeReviews(read.items, now) }
      })
  const posts = !include.includes('posts')
    ? null
    : await attempt('Posts', async () => {
        const read = await deps.maps((page) => readPlacePosts(page, business, LIMITS.posts.default))
        const unknown = postsUnknown(read)
        notes.push(unknown)
        return { ...read, analytics: analyzePosts(read.items, now), unknown }
      })
  const website = !include.includes('website') ? null : await readWebsite(deps, business, notes)
  const competitors = !include.includes('competitors')
    ? null
    : await attempt('Competitors', () => readCompetitors(deps, business, keyword, notes))

  const sample = reviews === null ? null : sampleNote(reviews)
  const extras: AuditExtras = {
    now,
    ...(reviews === null ? {} : { reviews: reviews.items }),
    ...(sample === null ? {} : { reviewsSample: sample }),
    // The browser sees only the newest post, which says nothing about cadence; those checks wait.
    ...(posts === null ? {} : { postsUnknown: posts.unknown }),
    ...(website === null ? {} : { website }),
    ...(competitors === null ? {} : { competitors }),
    ...(keyword === null ? {} : { keyword }),
  }
  const audit = auditProfile(business, extras)
  const report = profileReport(business, audit)
  return {
    business,
    findings: audit.findings,
    score: audit.score,
    fixes: report.fixes,
    reportMarkdown: reportMarkdown(report) + notesMarkdown(notes),
    notes,
    keyword,
    reviews,
    posts,
    website,
    competitors,
  }
}

async function readWebsite(
  deps: LocalDeps,
  business: Business,
  notes: string[],
): Promise<WebsiteCheck | null> {
  if (isMissing(business.website)) return null
  try {
    const read = await deps.website(business, business.website)
    if (read.status >= 400) notes.push(`The website answered HTTP ${read.status}.`)
    return read.website
  } catch (error) {
    notes.push(`The website was not read: ${error instanceof Error ? error.message : error}`)
    return null
  }
}

async function readCompetitors(
  deps: LocalDeps,
  business: Business,
  keyword: string | null,
  notes: string[],
): Promise<ScanRow[] | null> {
  const query =
    keyword ?? (isMissing(business.categories.primary) ? null : business.categories.primary)
  if (query === null) {
    notes.push('Competitors were not read: there was no keyword and no known primary category.')
    return null
  }
  const at = isMissing(business.location) ? null : business.location
  const read = await deps.maps((page) =>
    readResults(page, query, at, LIMITS.zoom.default, LIMITS.scan.default),
  )
  return scanTable(read.results.results, [], read.results.from)
}

function notesMarkdown(notes: readonly string[]): string {
  if (notes.length === 0) return ''
  return ['', '## Not read', '', ...notes.map((note) => `- ${note}`), ''].join('\n')
}
