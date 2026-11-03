// Where a business sits in a result list, and what a grid of such reads adds up to. A business
// not in the list is "not found within depth", never rank 0 or rank depth+1.
import type { BusinessIds, RankedBusiness } from '../business'
import type { GridPoint } from './grid'

export type PointRank =
  | { readonly kind: 'ranked'; readonly rank: number }
  /** Read the list to `depth` results and the business was not in it. */
  | { readonly kind: 'not_found'; readonly depth: number }
  /** The point could not be read (a provider failure, a captcha). */
  | { readonly kind: 'unknown'; readonly reason: string }

export interface GridCell {
  readonly point: GridPoint
  readonly rank: PointRank
}

/**
 * The target's position among organic results, matched by any shared id. A name match counts only
 * when neither side has an id, since branches of a chain share a name but never an id.
 */
export function rankIn(
  results: readonly RankedBusiness[],
  target: { readonly ids: BusinessIds; readonly name: string },
  depth: number,
): PointRank {
  const organic = results.filter((result) => !result.sponsored)
  const found =
    organic.find((result) => sameIds(result.ids, target.ids)) ??
    organic.find(
      (result) =>
        !hasId(result.ids) && !hasId(target.ids) && plain(result.name) === plain(target.name),
    )
  return found === undefined || found.position > depth
    ? { kind: 'not_found', depth }
    : { kind: 'ranked', rank: found.position }
}

export function sameIds(a: BusinessIds, b: BusinessIds): boolean {
  const pairs: [string | null, string | null][] = [
    [a.placeId, b.placeId],
    [a.cid, b.cid],
    [a.featureId, b.featureId],
    [a.kgId, b.kgId],
  ]
  return pairs.some(([x, y]) => x !== null && x === y)
}

function hasId(ids: BusinessIds): boolean {
  return ids.placeId !== null || ids.cid !== null || ids.featureId !== null || ids.kgId !== null
}

function plain(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

export interface GridSummary {
  readonly points: number
  readonly ranked: number
  readonly notFound: number
  readonly unknown: number
  /** Mean rank over points where the business ranked; null when it ranked nowhere. */
  readonly averageRank: number | null
  /** Share 0..1 of read points (ranked or not found) where it ranked 1-3; null when none read. */
  readonly top3Share: number | null
  readonly best: number | null
}

export function summarizeGrid(cells: readonly GridCell[]): GridSummary {
  const ranks = cells.flatMap((cell) => (cell.rank.kind === 'ranked' ? [cell.rank.rank] : []))
  const notFound = cells.filter((cell) => cell.rank.kind === 'not_found').length
  const read = ranks.length + notFound
  return {
    points: cells.length,
    ranked: ranks.length,
    notFound,
    unknown: cells.length - read,
    averageRank:
      ranks.length === 0
        ? null
        : Math.round((ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length) * 10) / 10,
    top3Share:
      read === 0 ? null : Math.round((ranks.filter((rank) => rank <= 3).length / read) * 100) / 100,
    best: ranks.length === 0 ? null : Math.min(...ranks),
  }
}
