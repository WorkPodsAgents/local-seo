// A local scan: every business on a results page side by side, with the profile details where
// they were read too. A detail no source gave is null, never 0.
import type { Business, LatLng, RankedBusiness } from '../business'
import { isMissing } from '../business'
import type { Known } from '../business'
import { distanceKm, sameIds } from '../geo'

export interface ScanRow {
  readonly position: number
  readonly sponsored: boolean
  readonly name: string
  readonly ids: RankedBusiness['ids']
  readonly primaryCategory: string | null
  /** Null when only the result list was read, which shows no secondary categories. */
  readonly secondaryCategories: readonly string[] | null
  readonly rating: number | null
  readonly reviewCount: number | null
  readonly photoCount: number | null
  readonly website: string | null
  readonly phone: string | null
  readonly claimed: boolean | null
  readonly address: string | null
  /**
   * Kilometres from the point searched from, one decimal; null when that point or the place's
   * pin is unknown. Proximity is the ranking factor a business cannot change, so a scan shows it.
   */
  readonly distanceKm: number | null
}

/** `from` is the point the search was seen from, such as the map centre. */
export function scanTable(
  results: readonly RankedBusiness[],
  details: readonly Business[] = [],
  from: LatLng | null = null,
): ScanRow[] {
  return results.map((result) => {
    const detail = details.find((business) => matches(business, result))
    const known = <T>(value: Known<T> | undefined): T | null =>
      value === undefined || isMissing(value) ? null : value
    const address = known(detail?.address)
    const pin = result.location ?? known(detail?.location)
    return {
      position: result.position,
      sponsored: result.sponsored,
      name: result.name,
      ids: result.ids,
      primaryCategory: result.primaryCategory ?? known(detail?.categories.primary),
      secondaryCategories: known(detail?.categories.secondary),
      rating: result.rating ?? known(detail?.rating),
      reviewCount: result.reviewCount ?? known(detail?.reviewCount),
      photoCount: known(detail?.photoCount),
      website: known(detail?.website),
      phone: known(detail?.phone),
      claimed: known(detail?.claimed),
      address: result.address ?? address?.formatted ?? null,
      distanceKm:
        from === null || pin === null ? null : Math.round(distanceKm(from, pin) * 10) / 10,
    }
  })
}

function matches(business: Business, result: RankedBusiness): boolean {
  return sameIds(business.ids, result.ids) || business.name.trim() === result.name.trim()
}

/** The scan as CSV for a spreadsheet; empty cells are unknown values. */
export function scanCsv(rows: readonly ScanRow[]): string {
  const header = [
    'position',
    'sponsored',
    'name',
    'primary_category',
    'secondary_categories',
    'rating',
    'review_count',
    'photo_count',
    'website',
    'phone',
    'claimed',
    'address',
    'distance_km',
    'place_id',
    'cid',
  ]
  const lines = rows.map((row) =>
    [
      row.position,
      row.sponsored,
      row.name,
      row.primaryCategory,
      row.secondaryCategories?.join('; ') ?? null,
      row.rating,
      row.reviewCount,
      row.photoCount,
      row.website,
      row.phone,
      row.claimed,
      row.address,
      row.distanceKm,
      row.ids.placeId,
      row.ids.cid,
    ]
      .map(cell)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n') + '\n'
}

function cell(value: string | number | boolean | null): string {
  if (value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
