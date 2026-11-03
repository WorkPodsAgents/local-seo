// Competitor research on DataForSEO Labs: who competes on a domain's keywords, the keywords a
// competitor ranks for that the domain does not, and what a domain ranks for.
import { bareHost } from '../../answers/host'
import type { Paid } from '../failure'
import { at, array, number, object, text } from '../json'
import type { DataForSeoDeps } from './http'
import { liveTask } from './http'
import type { KeywordMetrics, Market } from './keywords'
import { keywordRow, marketBody } from './keywords'
import { labsPrice } from './prices'

export interface CompetitorDomain {
  readonly domain: string
  /** Its average organic position on the shared keywords. */
  readonly avgPosition: number | null
  /** Keywords both domains rank for. */
  readonly sharedKeywords: number | null
  readonly organicKeywords: number | null
  /** Labs' estimated monthly organic traffic. */
  readonly organicTraffic: number | null
}

/** A keyword a domain ranks for, with where and how much traffic Labs estimates it brings. */
export interface RankedKeyword extends KeywordMetrics {
  readonly position: number | null
  readonly url: string | null
  readonly trafficEstimate: number | null
}

export interface RankedKeywords {
  readonly totalCount: number | null
  readonly keywords: readonly RankedKeyword[]
}

/** The keywords one competitor ranks for that the user's domain does not. */
export interface CompetitorGap {
  readonly competitor: string
  readonly totalCount: number | null
  readonly keywords: readonly RankedKeyword[]
}

const ORGANIC = ['organic']

/** Domains that compete with `target` in organic search, most shared keywords first. */
export async function competitorsDomain(
  deps: DataForSeoDeps,
  target: string,
  market: Market = {},
  limit = 20,
): Promise<Paid<readonly CompetitorDomain[]>> {
  const paid = await liveTask(
    deps,
    '/v3/dataforseo_labs/google/competitors_domain/live',
    {
      target: bareHost(target),
      ...marketBody(market),
      item_types: ORGANIC,
      limit,
      exclude_top_domains: true,
      order_by: ['intersections,desc'],
    },
    labsPrice(limit),
  )
  const items = array(object(paid.data[0])?.['items'])
  const data = items.flatMap((item) => {
    const domain = text(at(item, 'domain'))
    if (domain === null) return []
    return [
      {
        domain,
        avgPosition: number(at(item, 'avg_position')),
        sharedKeywords: number(at(item, 'intersections')),
        organicKeywords: number(at(item, 'full_domain_metrics', 'organic', 'count')),
        organicTraffic: number(at(item, 'full_domain_metrics', 'organic', 'etv')),
      },
    ]
  })
  return { ...paid, data }
}

/** What `target` ranks for, most traffic first. */
export async function rankedKeywords(
  deps: DataForSeoDeps,
  target: string,
  market: Market = {},
  limit = 100,
): Promise<Paid<RankedKeywords>> {
  const paid = await liveTask(
    deps,
    '/v3/dataforseo_labs/google/ranked_keywords/live',
    {
      target: bareHost(target),
      ...marketBody(market),
      item_types: ORGANIC,
      limit,
      order_by: ['ranked_serp_element.serp_item.etv,desc'],
    },
    labsPrice(limit),
  )
  const result = object(paid.data[0])
  const keywords = array(result?.['items']).flatMap((item) => {
    const row = keywordRow(item)
    return row === null ? [] : [ranked(row, at(item, 'ranked_serp_element', 'serp_item'))]
  })
  return { ...paid, data: { totalCount: number(result?.['total_count']), keywords } }
}

/**
 * The keyword gap: for each competitor, the keywords it ranks for that `domain` does not (Labs
 * domain_intersection with intersections false), most searched first. One call per competitor.
 */
export async function keywordGap(
  deps: DataForSeoDeps,
  domain: string,
  competitors: readonly string[],
  market: Market = {},
  limit = 100,
): Promise<Paid<readonly CompetitorGap[]>> {
  const own = bareHost(domain)
  const gaps = await Promise.all(
    competitors.map((competitor) => competitorGap(deps, own, bareHost(competitor), market, limit)),
  )
  return {
    data: gaps.map((gap) => gap.data),
    costUsd: gaps.reduce((sum, gap) => sum + gap.costUsd, 0),
    cached: gaps.every((gap) => gap.cached),
  }
}

async function competitorGap(
  deps: DataForSeoDeps,
  own: string,
  competitor: string,
  market: Market,
  limit: number,
): Promise<Paid<CompetitorGap>> {
  const paid = await liveTask(
    deps,
    '/v3/dataforseo_labs/google/domain_intersection/live',
    {
      target1: competitor,
      target2: own,
      ...marketBody(market),
      intersections: false,
      item_types: ORGANIC,
      limit,
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
    },
    labsPrice(limit),
  )
  const result = object(paid.data[0])
  const keywords = array(result?.['items']).flatMap((item) => {
    const row = keywordRow(item)
    return row === null ? [] : [ranked(row, at(item, 'first_domain_serp_element'))]
  })
  return {
    ...paid,
    data: { competitor, totalCount: number(result?.['total_count']), keywords },
  }
}

function ranked(row: KeywordMetrics, serpItem: unknown): RankedKeyword {
  return {
    ...row,
    position: number(at(serpItem, 'rank_group')),
    url: text(at(serpItem, 'url')),
    trafficEstimate: number(at(serpItem, 'etv')),
  }
}
