// Keyword research on DataForSEO Labs and the live Google SERP. Request and response shapes are
// ported from WorkPods' LabsRequests.kt and LabsAnswers.kt (snake_case on the wire).
import { bareHost } from '../../answers/host'
import type { Paid } from '../failure'
import { array, at, number, object, text } from '../json'
import { bulkRanks } from './backlinks'
import type { DataForSeoDeps } from './http'
import { liveTask } from './http'
import { locationCode } from './locations'
import { labsPrice, serpLivePrice } from './prices'

/** Where a search is made: an ISO country (default US) and a language code (default en). */
export interface Market {
  readonly location?: string
  readonly language?: string
}

export type SearchIntent = 'informational' | 'navigational' | 'commercial' | 'transactional'

/** A keyword's demand as Labs reports it; each figure null when not reported. */
export interface KeywordMetrics {
  readonly keyword: string
  /** Average monthly searches. */
  readonly searchVolume: number | null
  readonly cpcUsd: number | null
  /** Paid competition, 0 to 1. */
  readonly competition: number | null
  /** Labs keyword difficulty, 0 to 100. */
  readonly keywordDifficulty: number | null
  readonly intent: SearchIntent | null
}

export interface KeywordIdeas {
  /** How many ideas Labs holds in all; null when it does not say. */
  readonly totalCount: number | null
  readonly ideas: readonly KeywordMetrics[]
}

/** One organic result of a SERP's top 10, with its domain's strength. */
export interface SerpResult {
  /** The organic position, 1 to 10. */
  readonly rank: number
  readonly domain: string
  readonly url: string
  readonly title: string | null
  /** The domain's DataForSEO rank, 0 to 100; null when not reported. */
  readonly domainRank: number | null
}

const INTENTS: readonly SearchIntent[] = [
  'informational',
  'navigational',
  'commercial',
  'transactional',
]
/** keyword_overview takes at most 700 keywords. */
export const MAX_OVERVIEW_KEYWORDS = 700
const TOP = 10

export function marketBody(market: Market): { location_code: number; language_code: string } {
  return {
    location_code: locationCode(market.location ?? 'US'),
    language_code: market.language ?? 'en',
  }
}

/** Ideas for seed terms (Labs keyword_ideas), most searched first. */
export async function keywordIdeas(
  deps: DataForSeoDeps,
  seeds: readonly string[],
  market: Market = {},
  limit = 100,
): Promise<Paid<KeywordIdeas>> {
  const body = {
    keywords: seeds,
    ...marketBody(market),
    limit,
    order_by: ['keyword_info.search_volume,desc'],
  }
  const paid = await liveTask(
    deps,
    '/v3/dataforseo_labs/google/keyword_ideas/live',
    body,
    labsPrice(limit),
  )
  const result = object(paid.data[0])
  const ideas = array(result?.['items']).flatMap((item) => keywordRow(item) ?? [])
  return { ...paid, data: { totalCount: number(result?.['total_count']), ideas } }
}

/**
 * Search volume, keyword difficulty and intent for named keywords in one Labs keyword_overview
 * call, which reports all three, up to 700 keywords.
 */
export async function keywordMetrics(
  deps: DataForSeoDeps,
  keywords: readonly string[],
  market: Market = {},
): Promise<Paid<readonly KeywordMetrics[]>> {
  const batch = keywords.slice(0, MAX_OVERVIEW_KEYWORDS)
  const paid = await liveTask(
    deps,
    '/v3/dataforseo_labs/google/keyword_overview/live',
    { keywords: batch, ...marketBody(market) },
    labsPrice(batch.length),
  )
  const items = array(object(paid.data[0])?.['items'])
  return { ...paid, data: items.flatMap((item) => keywordRow(item) ?? []) }
}

/** The organic top 10 for a keyword (live SERP), each with its domain's rank. */
export async function serpTop10(
  deps: DataForSeoDeps,
  keyword: string,
  market: Market = {},
): Promise<Paid<readonly SerpResult[]>> {
  const serp = await liveTask(
    deps,
    '/v3/serp/google/organic/live/advanced',
    { keyword, ...marketBody(market), device: 'desktop', depth: TOP },
    serpLivePrice(TOP),
  )
  const organic = array(object(serp.data[0])?.['items'])
    .map(object)
    .flatMap((item) => {
      const rank = number(item?.['rank_group'])
      const domain = text(item?.['domain'])
      const url = text(item?.['url'])
      if (item?.['type'] !== 'organic' || rank === null || domain === null || url === null) {
        return []
      }
      return [{ rank, domain, url, title: text(item['title']) }]
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, TOP)
  if (organic.length === 0) return { ...serp, data: [] }
  const ranks = await bulkRanks(
    deps,
    organic.map((result) => result.domain),
  )
  const data = organic.map((result) => ({
    ...result,
    domainRank: ranks.data.get(bareHost(result.domain)) ?? null,
  }))
  return {
    data,
    costUsd: serp.costUsd + ranks.costUsd,
    cached: serp.cached && ranks.cached,
  }
}

function keywordOf(value: unknown): KeywordMetrics | null {
  const keyword = text(at(value, 'keyword'))
  if (keyword === null) return null
  const intent = text(at(value, 'search_intent_info', 'main_intent'))
  return {
    keyword,
    searchVolume: number(at(value, 'keyword_info', 'search_volume')),
    cpcUsd: number(at(value, 'keyword_info', 'cpc')),
    competition: number(at(value, 'keyword_info', 'competition')),
    keywordDifficulty: number(at(value, 'keyword_properties', 'keyword_difficulty')),
    intent: INTENTS.find((known) => known === intent) ?? null,
  }
}

/** Reads a keyword row of any Labs list: the row itself or its `keyword_data`. */
export function keywordRow(value: unknown): KeywordMetrics | null {
  return keywordOf(object(value)?.['keyword_data'] ?? value)
}
