// The DataForSEO operations bound to one set of dependencies, so the service worker wires the
// vault, the spend ledger and the cache once.
import type { Paid } from '../failure'
import type { LinkGap, ReferringDomains, BacklinksSummary } from './backlinks'
import { backlinksSummary, bulkRanks, linkGap, referringDomains } from './backlinks'
import type { CompetitorDomain, CompetitorGap, RankedKeywords } from './domains'
import { competitorsDomain, keywordGap, rankedKeywords } from './domains'
import type { DataForSeoDeps } from './http'
import type { KeywordIdeas, KeywordMetrics, Market, SerpResult } from './keywords'
import { keywordIdeas, keywordMetrics, serpTop10 } from './keywords'
import type { KeywordView } from './keyword-view'
import { keywordView } from './keyword-view'

export interface DataForSeo {
  keywordIdeas(
    seeds: readonly string[],
    market?: Market,
    limit?: number,
  ): Promise<Paid<KeywordIdeas>>
  keywordMetrics(
    keywords: readonly string[],
    market?: Market,
  ): Promise<Paid<readonly KeywordMetrics[]>>
  serpTop10(keyword: string, market?: Market): Promise<Paid<readonly SerpResult[]>>
  /** Metrics and the top 10 with domain strength, judged together; null for an unknown keyword. */
  keywordView(
    keyword: string,
    market?: Market,
    ownDomainRank?: number | null,
  ): Promise<Paid<KeywordView | null>>
  competitorsDomain(
    target: string,
    market?: Market,
    limit?: number,
  ): Promise<Paid<readonly CompetitorDomain[]>>
  keywordGap(
    domain: string,
    competitors: readonly string[],
    market?: Market,
    limit?: number,
  ): Promise<Paid<readonly CompetitorGap[]>>
  rankedKeywords(target: string, market?: Market, limit?: number): Promise<Paid<RankedKeywords>>
  backlinksSummary(target: string): Promise<Paid<BacklinksSummary>>
  referringDomains(target: string, limit?: number): Promise<Paid<ReferringDomains>>
  linkGap(domain: string, competitors: readonly string[], limit?: number): Promise<Paid<LinkGap>>
  bulkRanks(domains: readonly string[]): Promise<Paid<ReadonlyMap<string, number>>>
}

export function createDataForSeo(deps: DataForSeoDeps): DataForSeo {
  return {
    keywordIdeas: (seeds, market, limit) => keywordIdeas(deps, seeds, market, limit),
    keywordMetrics: (keywords, market) => keywordMetrics(deps, keywords, market),
    serpTop10: (keyword, market) => serpTop10(deps, keyword, market),
    async keywordView(keyword, market, ownDomainRank = null) {
      const [metrics, top10] = await Promise.all([
        keywordMetrics(deps, [keyword], market),
        serpTop10(deps, keyword, market),
      ])
      const row = metrics.data[0]
      return {
        data: row === undefined ? null : keywordView(row, top10.data, ownDomainRank),
        costUsd: metrics.costUsd + top10.costUsd,
        cached: metrics.cached && top10.cached,
      }
    },
    competitorsDomain: (target, market, limit) => competitorsDomain(deps, target, market, limit),
    keywordGap: (domain, competitors, market, limit) =>
      keywordGap(deps, domain, competitors, market, limit),
    rankedKeywords: (target, market, limit) => rankedKeywords(deps, target, market, limit),
    backlinksSummary: (target) => backlinksSummary(deps, target),
    referringDomains: (target, limit) => referringDomains(deps, target, limit),
    linkGap: (domain, competitors, limit) => linkGap(deps, domain, competitors, limit),
    bulkRanks: (domains) => bulkRanks(deps, domains),
  }
}
