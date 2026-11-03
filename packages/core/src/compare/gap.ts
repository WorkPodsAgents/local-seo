// Why the top results beat the target: the categories they share that it lacks, and how far its
// reviews, rating and photos sit from the competitors' median.
import type { Business } from '../business'
import { isMissing } from '../business'
import type { Known } from '../business'
import { sameIds } from '../geo'
import { median } from '../reviews'
import type { ScanRow } from './scan'

export interface CategoryUse {
  readonly category: string
  /** Competitors listing it as primary or secondary. */
  readonly usedBy: number
  readonly asPrimary: number
  /** usedBy over competitors whose categories are known, 0..1. */
  readonly share: number
}

/** How often each category appears among `rows`, most used first. */
export function categoryFrequency(rows: readonly ScanRow[]): CategoryUse[] {
  const known = rows.filter((row) => row.primaryCategory !== null)
  const uses = new Map<string, { usedBy: number; asPrimary: number }>()
  for (const row of known) {
    const all = new Set([row.primaryCategory ?? '', ...(row.secondaryCategories ?? [])])
    for (const category of all) {
      if (category === '') continue
      const entry = uses.get(category) ?? { usedBy: 0, asPrimary: 0 }
      entry.usedBy += 1
      if (category === row.primaryCategory) entry.asPrimary += 1
      uses.set(category, entry)
    }
  }
  return [...uses.entries()]
    .map(([category, entry]) => ({
      category,
      ...entry,
      share: Math.round((entry.usedBy / known.length) * 100) / 100,
    }))
    .sort((a, b) => b.usedBy - a.usedBy || b.asPrimary - a.asPrimary)
}

export interface MetricGap {
  /** Null when the target's own value is unknown. */
  readonly target: number | null
  /** Null when no competitor's value is known. */
  readonly competitorMedian: number | null
  /** target minus median; null when either side is unknown. */
  readonly difference: number | null
  /** Competitors the median rests on. */
  readonly known: number
}

export interface CompetitorGap {
  readonly competitors: number
  /** Categories competitors use that the target lists neither as primary nor secondary. */
  readonly missingCategories: readonly CategoryUse[]
  /** Competitors sharing the target's primary category; null when the target's is unknown. */
  readonly primarySharedBy: number | null
  readonly reviews: MetricGap
  readonly rating: MetricGap
  readonly photos: MetricGap
  /** Plain sentences for the panel and agents, biggest gap first. */
  readonly summary: readonly string[]
}

/** Compares `target` with `competitors`, leaving out any row that is the target itself. */
export function competitorGap(target: Business, competitors: readonly ScanRow[]): CompetitorGap {
  const others = competitors.filter(
    (row) => !row.sponsored && !sameIds(row.ids, target.ids) && row.name !== target.name,
  )
  const own = ownCategories(target)
  const frequency = categoryFrequency(others)
  const missingCategories = own === null ? frequency : frequency.filter((u) => !own.has(u.category))
  const primary = value(target.categories.primary)
  const reviews = gap(
    value(target.reviewCount),
    others.map((row) => row.reviewCount),
  )
  const rating = gap(
    value(target.rating),
    others.map((row) => row.rating),
  )
  const photos = gap(
    value(target.photoCount),
    others.map((row) => row.photoCount),
  )
  return {
    competitors: others.length,
    missingCategories,
    primarySharedBy:
      primary === null ? null : others.filter((row) => row.primaryCategory === primary).length,
    reviews,
    rating,
    photos,
    summary: summary(missingCategories, reviews, rating, photos, others.length),
  }
}

function ownCategories(target: Business): Set<string> | null {
  const primary = value(target.categories.primary)
  const secondary = value(target.categories.secondary)
  if (primary === null && secondary === null) return null
  return new Set([...(primary === null ? [] : [primary]), ...(secondary ?? [])])
}

function value<T>(known: Known<T>): T | null {
  return isMissing(known) ? null : known
}

function gap(target: number | null, values: readonly (number | null)[]): MetricGap {
  const known = values.filter((entry): entry is number => entry !== null)
  const competitorMedian = median(known)
  return {
    target,
    competitorMedian,
    difference:
      target === null || competitorMedian === null
        ? null
        : Math.round((target - competitorMedian) * 100) / 100,
    known: known.length,
  }
}

function summary(
  missing: readonly CategoryUse[],
  reviews: MetricGap,
  rating: MetricGap,
  photos: MetricGap,
  competitors: number,
): string[] {
  const lines: string[] = []
  const shared = missing.filter((use) => use.share >= 0.5)
  if (shared.length > 0) {
    const names = shared.map((use) => `${use.category} (${use.usedBy}/${competitors})`)
    lines.push(`Most competitors use categories this profile lacks: ${names.join(', ')}.`)
  }
  if (reviews.difference !== null && reviews.difference < 0) {
    lines.push(
      `${reviews.target} reviews against a competitor median of ${reviews.competitorMedian}.`,
    )
  }
  if (rating.difference !== null && rating.difference < 0) {
    lines.push(`Rated ${rating.target} against a competitor median of ${rating.competitorMedian}.`)
  }
  if (photos.difference !== null && photos.difference < 0) {
    lines.push(`${photos.target} photos against a competitor median of ${photos.competitorMedian}.`)
  }
  return lines
}
