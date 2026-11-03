// The twelve read-only Local SEO tools, as functions of their arguments. The bridge reaches them
// as `tool:<name>` router handlers (background/tools.ts); the side panel calls the same
// functions, so an agent and the user always get the same reads and the same numbers.
import {
  ALL_AI_ENGINES,
  LIMITS,
  type BusinessRef,
  type CategoryVolume,
  type Spend,
  type ToolArgs,
  type ToolName,
  type ToolResults,
} from '@local-seo/core/bridge'
import type { Business, LatLng, RankedBusiness } from '@local-seo/core/business'
import { isMissing, missing } from '@local-seo/core/business'
import { categoryFrequency, competitorGap, scanTable } from '@local-seo/core/compare'
import { gridPoints, summarizeGrid, mapsSearchUrl } from '@local-seo/core/geo'
import { profileChanges } from '@local-seo/core/history'
import { analyzePosts } from '@local-seo/core/posts'
import { businessSummary } from '@local-seo/core/report'
import { analyzeReviews } from '@local-seo/core/reviews'
import { auditProfile } from '@local-seo/core/audit'
import { mapsLivePrice } from '@local-seo/core/providers/dataforseo-local'
import { cloroEstimateUsd, localAiVisibility, localPrompt } from '../answers/visibility'
import { pointRank, runGrid, type PointRead } from '../maps/grid'
import {
  idsByName,
  openBusiness,
  openPlace,
  placeUrlOf,
  rankedOf,
  resolveNear,
} from '../maps/resolve'
import { GoogleBlocked, type MapsPage } from '../maps/page'
import { auditBusiness } from './audit'
import type { LocalDeps } from './deps'
import {
  clamp,
  countryOf,
  dataForSeoTarget,
  pageLanguageNote,
  postsUnknown,
  readBusiness,
  readPlacePosts,
  readPlaceReviews,
  reviewNotes,
  readResults,
  resultsShown,
} from './reads'

export type LocalTools = {
  readonly [T in ToolName]: (args: ToolArgs[T]) => Promise<ToolResults[T]>
}

/**
 * The top eight competitors' profiles are opened for their secondary categories, one at a time
 * in the one scratch tab, since parallel tabs read like a bot to Google. Eight keeps a run near
 * a minute; deeper results rank on proximity more than on their categories.
 */
const CATEGORY_DETAILS = 8

export function createLocalTools(deps: LocalDeps): LocalTools {
  const near = (page: MapsPage, at: ToolArgs['find_business']['near']) =>
    at === undefined ? Promise.resolve(null) : resolveNear(page, at)

  return {
    find_business: ({ query, near: at }) =>
      deps.maps(async (page) => {
        const from = await near(page, at)
        const read = await readResults(page, query, from, LIMITS.zoom.default, LIMITS.rankDepth)
        return { query, from, candidates: read.results.results }
      }),

    audit_profile: async ({ business, keyword, include }) => {
      const { read, language } = await deps.maps(async (page) => ({
        read: await readBusiness(deps, page, business),
        language: await pageLanguageNote(page),
      }))
      const audit = await auditBusiness(deps, read, include, keyword ?? null, language)
      return {
        business: audit.business,
        findings: audit.findings,
        score: audit.score,
        fixes: audit.fixes,
        reportMarkdown: audit.reportMarkdown,
        notes: audit.notes,
      }
    },

    read_reviews: async ({ business, max, source, cursor }) => {
      if (cursor !== undefined) return deps.reviewPages.next(cursor)
      const wanted = clamp(max ?? LIMITS.reviews.default, LIMITS.reviews.max)
      const target = await deps.maps((page) => readBusiness(deps, page, business))
      let spend: Spend | null = null
      let notes: string[] = []
      let newestFirst = true
      let stoppedByWant = false
      let reviews
      if (source === 'dataforseo') {
        const paid = await deps.paid(() =>
          deps.dataForSeo.reviews(dataForSeoTarget(target), { depth: wanted }),
        )
        reviews = paid.data
        stoppedByWant = paid.data.length >= wanted
        spend = { usd: paid.costUsd, cached: paid.cached }
      } else {
        const { read, language } = await deps.maps(async (page) => ({
          read: await readPlaceReviews(page, target, wanted),
          language: await pageLanguageNote(page),
        }))
        reviews = read.items
        notes = [...(language === null ? [] : [language]), ...reviewNotes(read)]
        newestFirst = read.newestFirst
        stoppedByWant = read.stoppedBy === 'want'
      }
      const total = isMissing(target.reviewCount) ? null : target.reviewCount
      return deps.reviewPages.first({
        business: businessSummary(target),
        reviews,
        analytics: analyzeReviews(reviews, deps.now()),
        read: reviews.length,
        order: newestFirst ? 'newest' : 'most_relevant',
        // With no known total, a read that stopped at `max` may have left reviews behind.
        truncated: total === null ? stoppedByWant : total > reviews.length,
        notes,
        spend,
      })
    },

    read_posts: async ({ business, max, source }) => {
      const wanted = clamp(max ?? LIMITS.posts.default, LIMITS.posts.max)
      const target = await deps.maps((page) => readBusiness(deps, page, business))
      if (source === 'dataforseo') {
        const paid = await deps.paid(() =>
          deps.dataForSeo.posts(dataForSeoTarget(target), { depth: wanted }),
        )
        return {
          business: businessSummary(target),
          posts: paid.data,
          analytics: analyzePosts(paid.data, deps.now()),
          truncated: paid.data.length >= wanted,
          unknown: null,
          spend: { usd: paid.costUsd, cached: paid.cached },
        }
      }
      const read = await deps.maps((page) => readPlacePosts(page, target, wanted))
      return {
        business: businessSummary(target),
        posts: read.items,
        analytics: analyzePosts(read.items, deps.now()),
        // The browser reads only the Overview's newest post, never the whole Updates list.
        truncated: true,
        unknown: postsUnknown(read),
        spend: null,
      }
    },

    local_scan: ({ query, near: at, max, withDetails }) =>
      deps.maps(async (page) => {
        const wanted = clamp(max ?? LIMITS.scan.default, LIMITS.scan.max)
        const from = await near(page, at)
        const read = await readResults(page, query, from, LIMITS.zoom.default, wanted)
        const results = read.results.results
        const details = withDetails === true ? await detailsOf(deps, page, results) : []
        const rows = scanTable(results, details, read.results.from)
        return {
          results: read.results,
          rows,
          categoryFrequency: categoryFrequency(rows.filter((row) => !row.sponsored)),
          detailsRead: details.length,
          truncated: read.stoppedBy === 'want',
        }
      }),

    rank_at: ({ query, business, at, zoom }) =>
      deps.maps(async (page) => {
        const target = await readBusiness(deps, page, business)
        const view = zoom ?? LIMITS.zoom.default
        const read = await readResults(page, query, at, view, LIMITS.rankDepth)
        // Ads take no rank, so the depth is counted in organic positions, ads kept alongside.
        const results = read.results.results.filter(
          (result) => result.sponsored || result.position <= LIMITS.rankDepth,
        )
        const rank = pointRank(results, read.stoppedBy, target, LIMITS.rankDepth)
        return { at, zoom: view, rank, results }
      }),

    geo_grid: (args) => geoGrid(deps, args),

    category_ideas: async ({ business, query, near: at, searchVolumes }) => {
      if (business === undefined && query === undefined) {
        throw new Error('Give a business, a query, or both.')
      }
      const found = await deps.maps(async (page) => {
        const target = business === undefined ? null : await readBusiness(deps, page, business)
        const search = query ?? primaryOf(target)
        if (search === null) {
          throw new Error('The business has no known primary category; pass a query.')
        }
        const from = at === undefined ? locationOf(target) : await resolveNear(page, at)
        const read = await readResults(page, search, from, LIMITS.zoom.default, 20)
        const organic = read.results.results.filter((result) => !result.sponsored)
        const others = organic.filter((result) => target === null || result.name !== target.name)
        const details = await detailsOf(deps, page, others.slice(0, CATEGORY_DETAILS))
        return { target, search, rows: scanTable(others, details) }
      })
      const categories = categoryFrequency(found.rows)
      const own = found.target === null ? null : ownCategories(found.target)
      const volumes =
        searchVolumes === true && (await deps.hasDataForSeo())
          ? await categoryVolumes(
              deps,
              categories.map((use) => use.category),
              found.target,
            )
          : null
      return {
        query: found.search,
        competitorsRead: found.rows.filter((row) => row.primaryCategory !== null).length,
        categories,
        missing: own === null ? null : categories.filter((use) => !own.has(use.category)),
        volumes: volumes?.volumes ?? null,
        spend: volumes?.spend ?? null,
      }
    },

    check_website_nap: async ({ business, url, profile }) => {
      let target: Business
      let profileFrom: 'maps' | 'arguments' = 'maps'
      if (business !== undefined) {
        const read = await deps.maps((page) => readBusiness(deps, page, business))
        target = profile === undefined ? read : withFacts(read, profile)
      } else if (profile !== undefined && url !== undefined) {
        target = withFacts(factsOnly(profile.name, deps.now()), profile)
        profileFrom = 'arguments'
      } else {
        throw new Error('Give a business, or a url with the profile facts to compare.')
      }
      const site = url ?? (isMissing(target.website) ? null : target.website)
      if (site === null) throw new Error('The profile links no website; pass the url to check.')
      const read = await deps.website(target, site)
      const { findings } = auditProfile(target, { now: deps.now(), website: read.website })
      return {
        website: read.website,
        findings: findings.filter((entry) => entry.group === 'website'),
        profileFrom,
        notes: read.status >= 400 ? [`The page answered HTTP ${read.status}.`] : [],
      }
    },

    compare_businesses: ({ businesses, keyword }) =>
      deps.maps(async (page) => {
        if (businesses.length < LIMITS.compare.min || businesses.length > LIMITS.compare.max) {
          throw new Error(`Compare ${LIMITS.compare.min} to ${LIMITS.compare.max} businesses.`)
        }
        const read: Business[] = []
        for (const ref of businesses) read.push(await readBusiness(deps, page, ref))
        const rows = scanTable(
          read.map((entry, at) => rankedOf(entry, at + 1)),
          read,
        )
        const [first] = read
        if (first === undefined) throw new Error('No business to compare.')
        let ranks = null
        if (keyword !== undefined) {
          // Seen from the first business, the market whose gap is measured.
          const list = await readResults(
            page,
            keyword,
            locationOf(first),
            LIMITS.zoom.default,
            LIMITS.rankDepth,
          )
          const shown = list.results.results
          ranks = read.map((entry) => pointRank(shown, list.stoppedBy, entry, LIMITS.rankDepth))
        }
        return { rows, gap: competitorGap(first, rows.slice(1)), ranks }
      }),

    profile_history: async ({ business }) => {
      const saved = await deps.snapshots.history(business)
      const snapshots =
        saved.length > 0 ? saved : await deps.maps((page) => historyViaMaps(deps, page, business))
      return {
        snapshots: snapshots.map((entry) => ({
          readAt: entry.readAt,
          summary: businessSummary(entry.business),
        })),
        changes: profileChanges(snapshots),
      }
    },

    local_ai_visibility: (args) => aiVisibility(deps, args),
  }
}

/** A DataForSEO grid costs the Maps live price at every point. */
export function gridEstimateUsd(size: number): number {
  return size * size * mapsLivePrice(LIMITS.rankDepth)
}

async function geoGrid(
  deps: LocalDeps,
  args: ToolArgs['geo_grid'],
): Promise<ToolResults['geo_grid']> {
  const source = args.source ?? 'browser'
  if (source === 'browser' && args.size > LIMITS.grid.browserMaxSize) {
    const max = LIMITS.grid.browserMaxSize
    throw new Error(`The browser source reads at most ${max}x${max}; use dataforseo for more.`)
  }
  const points = gridPoints(args.center, args.size, args.spacingKm)
  const estimatedCostUsd = source === 'dataforseo' ? gridEstimateUsd(args.size) : null
  const empty = { source, depth: LIMITS.rankDepth, estimatedCostUsd, spend: null }
  if (args.estimateOnly === true) return { ...empty, cells: [], summary: null }
  if (estimatedCostUsd !== null) {
    // Checked for the whole grid up front, so a grid never stops half paid for.
    const blocked = await deps.paidBlock('dataforseo', estimatedCostUsd)
    if (blocked !== null) throw new Error(blocked)
  }
  const zoom = args.zoom ?? LIMITS.zoom.default
  const business = await deps.maps((page) => readBusiness(deps, page, args.business))
  let usd = 0
  // Cached only when every point was answered from the cache; no answered point, not cached.
  let answered = 0
  let allCached = true
  const run = (page: MapsPage | null) => {
    const target = { ids: business.ids, name: business.name }
    return runGrid({
      points,
      target,
      depth: LIMITS.rankDepth,
      pauseMs: page === null ? 0 : deps.gridPauseMs,
      sleep: deps.sleep,
      stopped: deps.gridStopped,
      onCell: (_cell, done) => deps.onGridProgress({ done, total: points.length }),
      read: async (point): Promise<PointRead> => {
        if (page !== null) {
          const load = await page.open(mapsSearchUrl(args.query, point, zoom))
          if (load.blocked !== null) return { kind: 'blocked', reason: load.blocked }
          const list = await resultsShown(page, args.query, point, LIMITS.rankDepth)
          return { kind: 'results', results: list.results.results, stoppedBy: list.stoppedBy }
        }
        try {
          const paid = await deps.paid(() =>
            deps.dataForSeo.mapsAt(args.query, point, zoom, { depth: LIMITS.rankDepth }),
          )
          usd += paid.costUsd
          answered += 1
          allCached = allCached && paid.cached
          return { kind: 'results', results: paid.data.results, stoppedBy: null }
        } catch (error) {
          // A refused key or an empty balance fails every point alike; the grid stops.
          return { kind: 'blocked', reason: error instanceof Error ? error.message : String(error) }
        }
      },
    })
  }
  const cells = source === 'browser' ? await deps.maps((page) => run(page)) : await run(null)
  return {
    ...empty,
    cells,
    summary: summarizeGrid(cells),
    spend: source === 'dataforseo' ? { usd, cached: answered > 0 && allCached } : null,
  }
}

async function aiVisibility(
  deps: LocalDeps,
  args: ToolArgs['local_ai_visibility'],
): Promise<ToolResults['local_ai_visibility']> {
  const source = args.source ?? 'assist'
  const estimatedCostUsd =
    source === 'cloro' ? cloroEstimateUsd(args.engines ?? ALL_AI_ENGINES) : null
  if (args.estimateOnly === true) {
    return { prompt: localPrompt(args.query, args.city), answers: [], source, estimatedCostUsd }
  }
  if (estimatedCostUsd !== null) {
    // Checked for every engine up front, as geo_grid does, so a run never stops half paid for.
    const blocked = await deps.paidBlock('cloro', estimatedCostUsd)
    if (blocked !== null) throw new Error(blocked)
  }
  return localAiVisibility(args, await deps.answers(source))
}

/**
 * The history of a reference this device cannot place on its own: a name (a renamed profile, or
 * two places sharing a name, would match the wrong record), a short link, or an id the panel
 * never exposed. Maps says whose it is; a link or id is then remembered for the next lookup.
 */
async function historyViaMaps(deps: LocalDeps, page: MapsPage, ref: BusinessRef) {
  if ('name' in ref) return deps.snapshots.history(await refByName(page, ref))
  const place = await openBusiness(page, ref)
  await deps.snapshots.remember(ref, place.ids)
  return deps.snapshots.history(ref)
}

async function refByName(
  page: MapsPage,
  ref: { readonly name: string; readonly city: string },
): Promise<BusinessRef> {
  const ids = await idsByName(page, ref)
  if (ids.cid !== null) return { cid: ids.cid }
  if (ids.placeId !== null) return { placeId: ids.placeId }
  throw new Error(`Google Maps gave no id for "${ref.name}" to look its history up by.`)
}

async function detailsOf(
  deps: LocalDeps,
  page: MapsPage,
  results: readonly RankedBusiness[],
): Promise<Business[]> {
  const details: Business[] = []
  for (const result of results) {
    if (result.sponsored || (result.ids.cid === null && result.ids.placeId === null)) continue
    try {
      const place = await openPlace(page, placeUrlOf(result), result.ids)
      if (place === null) continue
      await deps.snapshots.save(place)
      details.push(place)
    } catch (error) {
      // Google refusing stops the details; one place that did not load does not.
      if (error instanceof GoogleBlocked) throw error
    }
  }
  return details
}

async function categoryVolumes(
  deps: LocalDeps,
  names: readonly string[],
  target: Business | null,
): Promise<{ volumes: CategoryVolume[]; spend: Spend }> {
  // Labs reads volumes per country; with none known the US market is read, as the tool's
  // description tells the agent, since category_ideas takes no country to ask for.
  const country = (target === null ? null : countryOf(target)) ?? 'US'
  const paid = await deps.paid(() => deps.keywordVolumes(names, country))
  const byName = new Map(paid.data.map((row) => [row.keyword.toLowerCase(), row.searchVolume]))
  return {
    volumes: names.map((category) => ({
      category,
      monthlySearches: byName.get(category.toLowerCase()) ?? null,
    })),
    spend: { usd: paid.costUsd, cached: paid.cached },
  }
}

function primaryOf(business: Business | null): string | null {
  if (business === null || isMissing(business.categories.primary)) return null
  return business.categories.primary
}

function locationOf(business: Business | null): LatLng | null {
  return business === null || isMissing(business.location) ? null : business.location
}

function ownCategories(business: Business): Set<string> | null {
  const primary = business.categories.primary
  const secondary = business.categories.secondary
  if (isMissing(primary) && isMissing(secondary)) return null
  return new Set([
    ...(isMissing(primary) ? [] : [primary]),
    ...(isMissing(secondary) ? [] : secondary),
  ])
}

const NOT_GIVEN = 'not passed to the check'

/** The agent's facts replace what was read; a fact left out keeps the read value. */
function withFacts(business: Business, facts: ToolArgs['check_website_nap']['profile']): Business {
  if (facts === undefined) return business
  return {
    ...business,
    name: facts.name,
    ...(facts.phone === undefined ? {} : { phone: facts.phone }),
    ...(facts.address === undefined
      ? {}
      : {
          address: {
            formatted: facts.address,
            street: null,
            city: null,
            region: null,
            postalCode: null,
            country: null,
          },
        }),
  }
}

/** A profile made only of the agent's facts; everything else is unknown, so not compared. */
function factsOnly(name: string, now: Date): Business {
  const unknown = missing(NOT_GIVEN)
  return {
    source: 'maps_page',
    readAt: now.toISOString(),
    ids: { placeId: null, cid: null, kgId: null, featureId: null },
    name,
    categories: { primary: unknown, secondary: unknown },
    address: unknown,
    serviceAreas: unknown,
    location: unknown,
    phone: unknown,
    website: unknown,
    hours: unknown,
    attributes: unknown,
    services: unknown,
    products: unknown,
    description: unknown,
    rating: unknown,
    reviewCount: unknown,
    photoCount: unknown,
    claimed: unknown,
    closure: null,
  }
}
