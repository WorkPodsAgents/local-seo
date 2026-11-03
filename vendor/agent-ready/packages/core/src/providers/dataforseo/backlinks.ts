// DataForSEO Backlinks: a domain's profile, its referring domains, the link gap against
// competitors and the rank of many domains at once. Live backlinks only, on the 0 to 100 rank
// scale WorkPods shows. These calls need DataForSEO's Backlinks subscription; without it they fail
// with no_access (see http.ts).
import { bareHost } from '../../answers/host'
import type { Paid } from '../failure'
import { ProviderError } from '../failure'
import { array, number, object, text } from '../json'
import type { DataForSeoDeps } from './http'
import { liveTask } from './http'
import { backlinksPrice } from './prices'

export interface BacklinksSummary {
  readonly target: string
  /** Domain rank, 0 to 100. */
  readonly rank: number | null
  readonly backlinks: number | null
  readonly referringDomains: number | null
  readonly brokenBacklinks: number | null
  /** 0 to 100; higher is spammier. */
  readonly spamScore: number | null
}

export interface ReferringDomain {
  readonly domain: string
  readonly rank: number | null
  readonly backlinks: number | null
  /** As DataForSEO writes it, `2024-03-01 10:00:00 +00:00`; null when not reported. */
  readonly firstSeen: string | null
}

export interface ReferringDomains {
  readonly totalCount: number | null
  readonly domains: readonly ReferringDomain[]
}

/** A domain linking to one or more competitors and not to the user's domain. */
export interface LinkGapDomain {
  readonly domain: string
  readonly rank: number | null
  /** The competitors it links to, as given. */
  readonly linksTo: readonly string[]
}

export interface LinkGap {
  readonly totalCount: number | null
  readonly domains: readonly LinkGapDomain[]
}

const SCALE = { rank_scale: 'one_hundred' } as const
const LIVE = { backlinks_status_type: 'live', exclude_internal_backlinks: true } as const
/** bulk_ranks and domain_intersection limits, as DataForSEO documents them. */
const MAX_BULK_TARGETS = 1000
const MAX_INTERSECTION_TARGETS = 20

export async function backlinksSummary(
  deps: DataForSeoDeps,
  target: string,
): Promise<Paid<BacklinksSummary>> {
  const host = bareHost(target)
  const paid = await liveTask(
    deps,
    '/v3/backlinks/summary/live',
    { target: host, include_subdomains: true, ...SCALE, ...LIVE },
    backlinksPrice(1),
  )
  const item = object(paid.data[0])
  return {
    ...paid,
    data: {
      target: host,
      rank: number(item?.['rank']),
      backlinks: number(item?.['backlinks']),
      referringDomains: number(item?.['referring_domains']),
      brokenBacklinks: number(item?.['broken_backlinks']),
      spamScore: number(item?.['backlinks_spam_score']),
    },
  }
}

/** The domains linking to `target`, strongest first. */
export async function referringDomains(
  deps: DataForSeoDeps,
  target: string,
  limit = 100,
): Promise<Paid<ReferringDomains>> {
  const paid = await liveTask(
    deps,
    '/v3/backlinks/referring_domains/live',
    { target: bareHost(target), limit, order_by: ['rank,desc'], ...SCALE, ...LIVE },
    backlinksPrice(limit),
  )
  const result = object(paid.data[0])
  const domains = array(result?.['items'])
    .map(object)
    .flatMap((item) => {
      const domain = text(item?.['domain'])
      if (domain === null) return []
      const firstSeen = text(item?.['first_seen'])
      return [
        { domain, rank: number(item?.['rank']), backlinks: number(item?.['backlinks']), firstSeen },
      ]
    })
  return { ...paid, data: { totalCount: number(result?.['total_count']), domains } }
}

/** Domains linking to any of `competitors` and not to `domain` (domain_intersection). */
export async function linkGap(
  deps: DataForSeoDeps,
  domain: string,
  competitors: readonly string[],
  limit = 100,
): Promise<Paid<LinkGap>> {
  if (competitors.length === 0 || competitors.length > MAX_INTERSECTION_TARGETS) {
    throw new ProviderError({ code: 'invalid_input', provider: 'dataforseo', field: 'competitors' })
  }
  const targets = Object.fromEntries(competitors.map((c, i) => [String(i + 1), bareHost(c)]))
  const paid = await liveTask(
    deps,
    '/v3/backlinks/domain_intersection/live',
    {
      targets,
      exclude_targets: [bareHost(domain)],
      limit,
      order_by: ['1.rank,desc'],
      ...SCALE,
    },
    backlinksPrice(limit),
  )
  const result = object(paid.data[0])
  const domains = array(result?.['items']).flatMap((item) => {
    const byTarget = object(object(item)?.['domain_intersection'])
    const linking = competitors.flatMap((competitor, i) => {
      const row = object(byTarget?.[String(i + 1)])
      const from = text(row?.['target'])
      return row === null || from === null ? [] : [{ competitor, from, rank: number(row['rank']) }]
    })
    const first = linking[0]
    if (first === undefined) return []
    return [{ domain: first.from, rank: first.rank, linksTo: linking.map((l) => l.competitor) }]
  })
  return { ...paid, data: { totalCount: number(result?.['total_count']), domains } }
}

/** The rank of each domain, keyed by its bare host; a domain DataForSEO does not know is absent. */
export async function bulkRanks(
  deps: DataForSeoDeps,
  domains: readonly string[],
): Promise<Paid<ReadonlyMap<string, number>>> {
  const targets = [...new Set(domains.map(bareHost))].slice(0, MAX_BULK_TARGETS)
  const paid = await liveTask(
    deps,
    '/v3/backlinks/bulk_ranks/live',
    { targets, ...SCALE },
    backlinksPrice(targets.length),
  )
  const ranks = new Map<string, number>()
  for (const item of array(object(paid.data[0])?.['items'])) {
    const target = text(object(item)?.['target'])
    const rank = number(object(item)?.['rank'])
    if (target !== null && rank !== null) ranks.set(bareHost(target), rank)
  }
  return { ...paid, data: ranks }
}
