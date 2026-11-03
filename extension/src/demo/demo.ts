// Demo mode for screenshots and the e2e smoke test: every panel message is answered from
// maps-reads.json, put through the same core checks the service worker runs. Development builds
// only. These screens go into the store listing and the docs, so every business in them is
// invented: the names, addresses, phones, websites, Place IDs, CIDs, KG IDs, feature ids, review
// texts and AI answers. Only the shape and the numbers come from the Maps pages saved for the
// tests (ratings, review counts, positions, coordinates, hours and attributes), so the screens
// lay out as they do for a real business. The older reviews, the posts, the website reading,
// the grid ranks and the AI answers are made up as well; each is marked as such below.
import { auditProfile } from '@local-seo/core/audit'
import type {
  AiEngine,
  AiSource,
  GeoGridResult,
  LocalAiVisibilityResult,
  ReadPostsResult,
  ReadReviewsResult,
  ToolArgs,
} from '@local-seo/core/bridge'
import { answerVisibility } from '@local-seo/core/ai'
import type { Business, LocalResults, Post, Review } from '@local-seo/core/business'
import { isMissing } from '@local-seo/core/business'
import { categoryFrequency, scanTable } from '@local-seo/core/compare'
import { distanceKm, gridPoints, rankIn, summarizeGrid, type GridCell } from '@local-seo/core/geo'
import { profileChanges } from '@local-seo/core/history'
import type { WebsiteCheck } from '@local-seo/core/nap'
import { analyzePosts } from '@local-seo/core/posts'
import { businessSummary, profileReport, reportMarkdown } from '@local-seo/core/report'
import { analyzeReviews } from '@local-seo/core/reviews'
import { mapsLivePrice, reviewsPrice } from '@local-seo/core/providers/dataforseo-local'
import type { Cost, PaidRequest } from '../shared/api'
import type { BusinessView, Draft, ScanView } from '../shared/local'
import type { Status } from '../shared/settings'
import { postsUnknown } from '../services/reads'
import { emitDemo, type Demo } from '../ui/client'
import reads from './maps-reads.json'

/** Made up: what a Cloro run of three engines is shown to cost. */
const CLORO_DEMO_USD = 0.038
const NOW = new Date('2026-11-03T00:00:00Z')

const place = reads.place as unknown as Business

/** Made up: what a signed-in reader would add, which the signed-out pages hide. */
const profile: Partial<Business> = {
  categories: { primary: 'Dentist', secondary: ['Emergency dental service'] },
  claimed: true,
  description:
    'Lamar Street Dental offers complete dental care to patients of all ages in Austin, ' +
    'from cleanings and fillings to crowns and same-day emergency visits.',
}

const business: Business = {
  ...place,
  ...profile,
  attributes: reads.attributes as Business['attributes'],
}
const results = reads.results as unknown as LocalResults

/** Made up: a year of older reviews behind the five Maps showed, a few of them unhappy. */
function olderReviews(): Review[] {
  const texts: readonly (readonly [number, string])[] = [
    [5, 'Dr. Hollis and the team were gentle and explained every step of my crown.'],
    [5, 'Quick cleaning, friendly hygienist, and they ran my insurance on the spot.'],
    [2, 'Front desk lost my appointment and I waited 40 minutes. The cleaning was fine.'],
    [5, 'Best dentist in Austin, my whole family has come here for years.'],
    [4, 'Easy parking and on time. A little pricey without insurance.'],
    [1, 'Billing charged me twice and nobody called back about it.'],
    [5, 'They fit me in the same day for a cracked tooth. Painless and quick.'],
    [3, 'Good hygienist, but the office felt rushed and I had to ask about X-ray costs.'],
    [5, 'Friendly staff who remember you. My kids actually like going to the dentist now.'],
    [2, 'Booked online, then got a call that the slot did not exist. Rebooked a week later.'],
  ]
  // A fixed sequence, so every screenshot shows the same reviews.
  let seed = 7
  const next = () => (seed = (seed * 48271) % 2147483647) / 2147483647
  return Array.from({ length: 46 }, (_, at) => {
    const [rating, text] = texts[Math.floor(next() * texts.length)] ?? [5, '']
    const days = 25 + at * 9 + Math.floor(next() * 8)
    const date = new Date(NOW.getTime() - days * 86_400_000).toISOString().slice(0, 10)
    const answered = next() < (rating >= 4 ? 0.85 : 0.4)
    return {
      id: `demo-${at}`,
      rating,
      text,
      publishedAt: date,
      relativeAge: null,
      ownerReply: answered ? { text: 'Thank you for visiting us!', publishedAt: null } : null,
      authorReviewCount: 1 + (at % 9),
      photoCount: next() < 0.15 ? 1 : 0,
    }
  })
}

const reviews: Review[] = [...(reads.reviews as unknown as Review[]), ...olderReviews()]

/** Made up: the profile's posts, which Maps hides when signed out; DataForSEO reads them all. */
const posts: Post[] = [
  ['2026-10-21', 'Now booking same-week appointments for new patients.', true],
  ['2026-09-30', 'Our office is closed Monday for Labor Day. Emergencies: call us.', false],
  ['2026-08-12', 'Back to school checkups for kids, with a free fluoride treatment.', true],
  ['2026-05-02', 'Meet Dr. Hollis, caring for Austin families for over 20 years.', true],
].map(([date, text, media]) => ({
  text: String(text),
  publishedAt: String(date),
  relativeAge: null,
  hasMedia: media === true,
  link: 'http://lamarstreetdental.example/',
  kind: 'update' as const,
}))

/** Made up: what the website check found on the business's site. */
const website: WebsiteCheck = {
  url: 'http://lamarstreetdental.example/',
  name: { status: 'match', profile: 'Lamar Street Dental', found: ['Lamar Street Dental'] },
  address: {
    status: 'match',
    profile: '1450 Cedar Hollow Dr Ste 210, Austin, TX 78704',
    found: ['1450 Cedar Hollow Dr #210, Austin, TX 78704'],
  },
  phone: { status: 'mismatch', profile: '(512) 555-0142', found: ['(512) 555-0187'] },
  hours: { status: 'not_found', profile: 'mon 08:00-16:00; …', found: [] },
  localSchema: { types: ['Dentist'], missing: ['openingHours', 'geo'] },
  telLinks: ['tel:+15125550187'],
  embeddedMap: false,
}

// Measured from the office, as the audit reads competitors around the business.
const competitors = scanTable(
  results.results,
  [],
  isMissing(place.location) ? null : place.location,
)
const keyword = 'dentist'
/** As in the browser: the Overview's newest post only, so posting cadence is unknown. */
const newestPost = posts.slice(0, 1)
const postsRead = { items: newestPost, stoppedBy: 'end' as const }
const postsUnknownWhy = postsUnknown(postsRead)
const audit = auditProfile(business, {
  now: NOW,
  reviews,
  postsUnknown: postsUnknownWhy,
  website,
  competitors,
  keyword,
})
const report = profileReport(business, audit)
const reviewAnalytics = analyzeReviews(reviews, NOW)
const postAnalytics = analyzePosts(posts, NOW)

/** Made up: an earlier visit, two weeks ago, with fewer reviews. */
const earlier = {
  readAt: '2026-10-20T15:12:00.000Z',
  business: { ...business, readAt: '2026-10-20T15:12:00.000Z', reviewCount: 176, photoCount: 5 },
}
const current = { readAt: business.readAt, business }

const view: BusinessView = {
  business,
  findings: audit.findings,
  score: audit.score,
  fixes: report.fixes,
  reportMarkdown: reportMarkdown(report),
  notes: [
    'Signed out of Google, Maps shows only a few reviews; sign in to Google in this browser ' +
      'to read them all.',
    postsUnknownWhy,
  ],
  keyword,
  reviews: {
    items: reviews,
    analytics: reviewAnalytics,
    stoppedBy: 'limited_view',
    newestFirst: true,
  },
  posts: {
    ...postsRead,
    analytics: analyzePosts(newestPost, NOW),
    unknown: postsUnknownWhy,
  },
  website,
  competitors,
  history: { previous: earlier, changes: profileChanges([earlier, current]) },
}

/** Made up: ranks that fall away with distance from the office, as local ranks do. */
function gridOf(args: ToolArgs['geo_grid']): GeoGridResult {
  const points = gridPoints(args.center, args.size, args.spacingKm)
  const cells: GridCell[] = points.map((point) => {
    const km = distanceKm(point, args.center)
    // East of the office (towards downtown) ranks worse than the residential south-west.
    const east = (point.lng - args.center.lng) * 60
    const rank = Math.round(
      1 + km ** 1.5 * 2.2 + Math.max(0, east) * 2 + ((point.row + point.col) % 2),
    )
    return {
      point,
      rank: rank > 20 ? { kind: 'not_found', depth: 20 } : { kind: 'ranked', rank },
    }
  })
  const paid = args.source === 'dataforseo'
  return {
    source: args.source ?? 'browser',
    depth: 20,
    cells,
    summary: summarizeGrid(cells),
    estimatedCostUsd: paid ? args.size * args.size * mapsLivePrice(20) : null,
    spend: paid ? { usd: args.size * args.size * mapsLivePrice(20), cached: false } : null,
  }
}

/** Made up: what each assistant answered, built from the invented competitors on the page. */
function answersOf(
  args: ToolArgs['local_ai_visibility'],
  source: AiSource,
): LocalAiVisibilityResult {
  const names = results.results.map((result) => result.name)
  const list = (picks: number[]) =>
    picks.map((at, n) => `${n + 1}. **${names[at] ?? ''}** - well reviewed.`).join('\n')
  const texts: Readonly<Record<AiEngine, string | null>> = {
    chatgpt: `Here are highly rated dentists in Austin, TX:\n${list([1, 0, 4, 2])}`,
    gemini: `Some well-reviewed options in Austin:\n${list([2, 4, 1, 6, 0])}`,
    perplexity: null,
    ai_mode: `Top-rated dentists near Austin:\n${list([1, 4, 2])}`,
  }
  const engines = args.engines ?? ['chatgpt', 'gemini', 'perplexity', 'ai_mode']
  return {
    source,
    estimatedCostUsd: source === 'cloro' ? CLORO_DEMO_USD : null,
    prompt: `What is the best ${args.query} in ${args.city}?`,
    answers: engines.map((engine) => {
      const text = texts[engine]
      return {
        engine,
        answer:
          text === null
            ? {
                missing: true,
                reason:
                  'Nobody sent the prompt in Perplexity within 5 minutes, so there is no answer.',
              }
            : answerVisibility({
                text,
                citedUrls: ['https://www.yelp.com/search?find_desc=dentist&find_loc=Austin'],
                businessName: args.businessName,
                competitors: args.competitors ?? [],
              }),
      }
    }),
  }
}

const DRAFTS: Readonly<Record<string, string>> = {
  description:
    'Lamar Street Dental is a family and general dental practice on Cedar Hollow Drive, ' +
    'caring for patients across South Austin. We offer cleanings and exams, fillings, crowns ' +
    'and emergency visits, and we explain every step before we start. Our office has ' +
    'wheelchair accessible parking, entrance and restrooms, and assisted listening devices. ' +
    'We are open Monday to Thursday, 8 am to 4 pm.',
  post:
    'Now booking same-week appointments for new patients. If it has been a while since your ' +
    'last cleaning, we will check your teeth and gums, take any X-rays you need, and talk ' +
    'through a plan with no pressure. Book online or tap Call to find a time this week.',
  services: 'Dental cleaning\nDental exam\nFillings\nCrowns\nEmergency dental care\nX-rays',
  review_reply:
    'Thank you for telling us, and we are sorry about the wait and the billing trouble. That ' +
    'is not the visit we want for anyone. Please call our office manager so we can put it ' +
    'right.',
}

const status: Status = {
  vault: 'unlocked',
  remembered: true,
  stored: ['dataforseo_login', 'dataforseo_password', 'anthropic_key'],
  link: 'connected',
  paired: true,
  problem: null,
  spend: {
    month: '2026-11',
    providers: {
      dataforseo: { capUsd: 10, spentUsd: 0.42, reservedUsd: 0 },
      cloro: { capUsd: null, spentUsd: 0, reservedUsd: 0 },
    },
  },
  settings: { cacheDays: 7, agentLink: true },
}

function estimateOf(request: PaidRequest): Cost {
  switch (request.op) {
    case 'paid:geo_grid':
      return { provider: 'dataforseo', usd: request.args.size ** 2 * mapsLivePrice(20) }
    case 'paid:read_reviews':
      return { provider: 'dataforseo', usd: reviewsPrice(request.args.max ?? 50, 'high') }
    case 'paid:read_posts':
      return { provider: 'dataforseo', usd: 0.0045 }
    case 'paid:category_volumes':
      return { provider: 'dataforseo', usd: 0.012 }
    case 'paid:ai_answers':
      return { provider: 'cloro', usd: CLORO_DEMO_USD }
  }
}

// Measured from the map centre, as the Local scan measures the page in front of the user.
const scanRows = scanTable(results.results, [], results.from)
const scan: ScanView = {
  results,
  rows: scanRows,
  categoryFrequency: categoryFrequency(scanRows),
  detailsRead: 0,
  truncated: true,
  stoppedBy: 'want',
}

const reviewsRead: ReadReviewsResult = {
  business: businessSummary(business),
  reviews: reviews.slice(0, 100),
  analytics: reviewAnalytics,
  read: reviews.length,
  order: 'newest',
  truncated: true,
  nextCursor: null,
  notes: [],
  spend: null,
}

const newestPostRead: ReadPostsResult = {
  business: businessSummary(business),
  posts: newestPost,
  analytics: analyzePosts(newestPost, NOW),
  truncated: true,
  unknown: postsUnknownWhy,
  spend: null,
}

const allPostsRead: ReadPostsResult = {
  business: businessSummary(business),
  posts,
  analytics: postAnalytics,
  truncated: false,
  unknown: null,
  spend: { usd: 0.0045, cached: false },
}

const later = <T>(value: T, ms = 150) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

const HANDLERS: Readonly<Record<string, (payload: never) => Promise<unknown>>> = {
  status: () => later(status, 0),
  'business:last': () => later(view, 0),
  'business:audit': () => later(view),
  'scan:tab': () => later(scan),
  'overlay:set': () => later(18),
  estimate: (request: PaidRequest) => later(estimateOf(request), 0),
  'local:find_business': (args: ToolArgs['find_business']) =>
    later({
      query: args.query,
      from: typeof args.near === 'object' ? args.near : results.from,
      candidates: results.results,
    }),
  'local:rank_at': (args: ToolArgs['rank_at']) =>
    later({
      at: args.at,
      zoom: 14,
      rank: rankIn(results.results, business, 20),
      results: results.results,
    }),
  'local:geo_grid': async (args: ToolArgs['geo_grid']) => {
    const total = args.size * args.size
    for (const done of [Math.ceil(total / 3), Math.ceil((2 * total) / 3), total]) {
      emitDemo('grid:progress', { done, total })
      await later(null, 80)
    }
    return gridOf(args)
  },
  'paid:geo_grid': async (args: ToolArgs['geo_grid']) => {
    const data = gridOf({ ...args, source: 'dataforseo' })
    return later({ data, costUsd: data.spend?.usd ?? 0, cached: false })
  },
  'local:read_reviews': () => later(reviewsRead),
  'paid:read_reviews': () => later({ data: reviewsRead, costUsd: 0.015, cached: false }),
  'local:read_posts': () => later(newestPostRead),
  'paid:read_posts': () => later({ data: allPostsRead, costUsd: 0.0045, cached: false }),
  'local:check_website_nap': () =>
    later({
      website,
      findings: audit.findings.filter((finding) => finding.group === 'website'),
      profileFrom: 'maps',
      notes: [],
    }),
  'local:profile_history': () =>
    later({
      snapshots: [earlier, current].map((entry) => ({
        readAt: entry.readAt,
        summary: businessSummary(entry.business),
      })),
      changes: view.history.changes,
    }),
  'answers:assist': (args: ToolArgs['local_ai_visibility']) =>
    later(answersOf(args, 'assist'), 300),
  'paid:ai_answers': (args: ToolArgs['local_ai_visibility']) =>
    later({ data: answersOf(args, 'cloro'), costUsd: CLORO_DEMO_USD, cached: false }, 300),
  'draft:write': (request: { kind: string }) =>
    later<Draft>({
      text: DRAFTS[request.kind] ?? '',
      services: request.kind === 'services' ? (DRAFTS['services'] ?? '').split('\n') : null,
      model: 'Claude (claude-sonnet-5-5)',
    }),
  'grid:stop': () => later(null, 0),
}

export const demo: Demo = {
  tab: { id: 1, url: reads.placeUrl },
  answer: (type, payload) => {
    const handler = HANDLERS[type]
    if (handler === undefined)
      return Promise.reject(new Error(`The demo has no answer for ${type}.`))
    return handler(payload as never)
  },
}
