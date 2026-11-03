import { describe, expect, it } from 'vitest'
import type { RankedBusiness } from '../src/business'
import { missing } from '../src/business'
import { categoryFrequency, competitorGap, scanCsv, scanTable } from '../src/compare'
import { aBusiness } from './business'

function ranked(position: number, name: string, category: string, reviews: number | null) {
  const entry: RankedBusiness = {
    position,
    sponsored: false,
    name,
    ids: { placeId: `ChIJ${position}`, cid: null, kgId: null, featureId: null },
    primaryCategory: category,
    rating: 4.8,
    reviewCount: reviews,
    address: null,
    location: null,
  }
  return entry
}

const RESULTS = [
  ranked(1, 'Rockland Rooter', 'Plumber', 300),
  ranked(2, 'Nyack Plumbing Co', 'Plumber', 120),
  ranked(3, 'Hudson Heat', 'Heating contractor', 200),
  ranked(4, 'Valley Drains', 'Plumber', null),
]

describe('local scan', () => {
  const details = [
    aBusiness({
      name: 'Rockland Rooter',
      ids: { placeId: 'ChIJ1', cid: null, kgId: null, featureId: null },
      categories: { primary: 'Plumber', secondary: ['Gas installation service'] },
      photoCount: 90,
    }),
    aBusiness({
      name: 'Hudson Heat',
      ids: { placeId: 'ChIJ3', cid: null, kgId: null, featureId: null },
      categories: {
        primary: 'Heating contractor',
        secondary: ['Gas installation service', 'Plumber'],
      },
      photoCount: 30,
    }),
  ]
  const rows = scanTable(RESULTS, details)

  it('given results and some profiles, then each row joins them and unknowns stay null', () => {
    expect(rows[0]).toMatchObject({
      secondaryCategories: ['Gas installation service'],
      photoCount: 90,
    })
    expect(rows[3]).toMatchObject({
      secondaryCategories: null,
      photoCount: null,
      reviewCount: null,
    })
  })

  it('then category frequency counts primary and secondary uses among known rows', () => {
    expect(categoryFrequency(rows.slice(0, 3))[0]).toEqual({
      category: 'Plumber',
      usedBy: 3,
      asPrimary: 2,
      share: 1,
    })
  })

  it('when the target is compared, then it leaves itself out and names the gaps', () => {
    const target = aBusiness({ photoCount: 20 })
    const gap = competitorGap(target, rows)
    expect(gap.competitors).toBe(3)
    expect(gap.missingCategories.map((use) => use.category)).toEqual([
      'Gas installation service',
      'Heating contractor',
    ])
    expect(gap.reviews).toEqual({ target: 120, competitorMedian: 250, difference: -130, known: 2 })
    expect(gap.photos).toEqual({ target: 20, competitorMedian: 60, difference: -40, known: 2 })
    expect(gap.summary).toEqual([
      'Most competitors use categories this profile lacks: Gas installation service (2/3).',
      '120 reviews against a competitor median of 250.',
      'Rated 4.6 against a competitor median of 4.8.',
      '20 photos against a competitor median of 60.',
    ])
  })

  it("given the target's own count is unknown, then the gap is null, not a negative number", () => {
    const gap = competitorGap(aBusiness({ reviewCount: missing('not read') }), rows)
    expect(gap.reviews.difference).toBeNull()
  })

  it('when exported, then the CSV quotes commas and leaves unknowns empty', () => {
    const csv = scanCsv(scanTable([ranked(1, 'Smith, Jones & Co', 'Plumber', null)]))
    expect(csv.split('\n')[1]).toBe('1,false,"Smith, Jones & Co",Plumber,,4.8,,,,,,,,ChIJ1,')
  })

  it('given the searched point, then each row says how far away it is, null without a pin', () => {
    const from = { lat: 41.1, lng: -73.95 }
    const pinned = { ...ranked(1, 'Rockland Rooter', 'Plumber', 300), location: from }
    const near = { ...ranked(2, 'Hudson Heat', 'Plumber', 1), location: { lat: 41.2, lng: -73.95 } }
    const rows = scanTable([pinned, near, ranked(3, 'Valley Drains', 'Plumber', null)], [], from)
    expect(rows.map((row) => row.distanceKm)).toEqual([0, 11.1, null])
    expect(scanTable([near]).map((row) => row.distanceKm)).toEqual([null])
  })
})
