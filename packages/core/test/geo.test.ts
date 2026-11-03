import { describe, expect, it } from 'vitest'
import type { RankedBusiness } from '../src/business'
import {
  distanceKm,
  gridPoints,
  mapsSearchUrl,
  parseMapsUrl,
  rankIn,
  summarizeGrid,
  businessRefUrl,
} from '../src/geo'
import type { GridCell } from '../src/geo'

const CENTER = { lat: 41.0973, lng: -73.9934 }

describe('grid geometry', () => {
  it('given a 5x5 grid at 1 km, then neighbours are 1 km apart', () => {
    const points = gridPoints(CENTER, 5, 1)
    expect(points).toHaveLength(25)
    const at = (row: number, col: number) => points.find((p) => p.row === row && p.col === col)!
    expect(at(2, 2)).toMatchObject(CENTER)
    expect(distanceKm(at(2, 2), at(2, 3))).toBeCloseTo(1, 3)
    expect(distanceKm(at(2, 2), at(1, 2))).toBeCloseTo(1, 3)
    expect(at(0, 0).lat).toBeGreaterThan(CENTER.lat)
    expect(at(0, 0).lng).toBeLessThan(CENTER.lng)
  })

  it('when the size is even or out of range, then it refuses', () => {
    expect(() => gridPoints(CENTER, 4, 1)).toThrow('grid size must be odd')
    expect(() => gridPoints(CENTER, 15, 1)).toThrow('grid size must be odd')
  })
})

describe('Maps URLs', () => {
  it('given a query, point and zoom, then the search URL opens Maps there', () => {
    expect(mapsSearchUrl('emergency plumber', CENTER, 14)).toBe(
      'https://www.google.com/maps/search/emergency+plumber/@41.0973,-73.9934,14z',
    )
  })

  it('given a place URL, then centre, zoom, feature id, CID, place id and KG id are read', () => {
    const url =
      'https://www.google.com/maps/place/RustyBrick,+Inc./@41.097343,-73.9934641,17z/data=' +
      '!3m1!4b1!4m6!3m5!1s0x89c2e830ac1a4c3f:0x28e48b1a90ccf57e!8m2!3d41.097343!4d-73.9934641' +
      '!16s%2Fg%2F1tf8w4ld!19sChIJP0warDDowokRfvXMkBqL5Cg'
    expect(parseMapsUrl(url)).toEqual({
      center: { lat: 41.097343, lng: -73.9934641 },
      zoom: 17,
      ids: {
        placeId: 'ChIJP0warDDowokRfvXMkBqL5Cg',
        cid: '2946633002421908862',
        kgId: '/g/1tf8w4ld',
        featureId: '0x89c2e830ac1a4c3f:0x28e48b1a90ccf57e',
      },
      query: 'RustyBrick, Inc.',
    })
  })

  it('given cid, ludocid or query_place_id links, then the id is read without a centre', () => {
    expect(parseMapsUrl('https://maps.google.com/?cid=2946633002421908862')?.ids.cid).toBe(
      '2946633002421908862',
    )
    expect(parseMapsUrl('https://www.google.com/search?q=rustybrick&ludocid=42')?.ids.cid).toBe(
      '42',
    )
    const byPlace = parseMapsUrl(
      'https://www.google.com/maps/search/?api=1&query=x&query_place_id=ChIJabc',
    )
    expect(byPlace?.ids.placeId).toBe('ChIJabc')
    expect(byPlace?.center).toBeNull()
    expect(parseMapsUrl('not a url')).toBeNull()
  })
})

describe('ranks and grid summaries', () => {
  const ids = (cid: string) => ({ placeId: null, cid, kgId: null, featureId: null })
  const results: RankedBusiness[] = [
    {
      position: 1,
      sponsored: true,
      name: 'Target',
      ids: ids('1'),
      primaryCategory: null,
      rating: null,
      reviewCount: null,
      address: null,
      location: null,
    },
    {
      position: 1,
      sponsored: false,
      name: 'Other',
      ids: ids('2'),
      primaryCategory: null,
      rating: null,
      reviewCount: null,
      address: null,
      location: null,
    },
    {
      position: 2,
      sponsored: false,
      name: 'Target',
      ids: ids('1'),
      primaryCategory: null,
      rating: null,
      reviewCount: null,
      address: null,
      location: null,
    },
  ]

  it('given an ad and an organic listing, then the rank is the organic one', () => {
    expect(rankIn(results, { ids: ids('1'), name: 'Target' }, 20)).toEqual({
      kind: 'ranked',
      rank: 2,
    })
    expect(rankIn(results, { ids: ids('9'), name: 'Absent' }, 20)).toEqual({
      kind: 'not_found',
      depth: 20,
    })
  })

  it('given another branch of a chain with its own id, then it is not the target', () => {
    const branch = (position: number, cid: string | null): RankedBusiness => ({
      ...results[1]!,
      position,
      name: 'Starbucks',
      ids: cid === null ? noIds : ids(cid),
    })
    const noIds = { placeId: null, cid: null, kgId: null, featureId: null }
    const chain = [branch(1, '111'), branch(2, '222')]
    expect(rankIn(chain, { ids: ids('222'), name: 'Starbucks' }, 20)).toEqual({
      kind: 'ranked',
      rank: 2,
    })
    expect(rankIn([branch(1, '111')], { ids: ids('222'), name: 'Starbucks' }, 20)).toEqual({
      kind: 'not_found',
      depth: 20,
    })
    expect(rankIn([branch(3, null)], { ids: noIds, name: 'Starbucks' }, 20)).toEqual({
      kind: 'ranked',
      rank: 3,
    })
  })

  it('given ranked, missing and unread points, then not found is never averaged as a rank', () => {
    const [a, b, c, d] = gridPoints(CENTER, 3, 1)
    const cells: GridCell[] = [
      { point: a!, rank: { kind: 'ranked', rank: 1 } },
      { point: b!, rank: { kind: 'ranked', rank: 6 } },
      { point: c!, rank: { kind: 'not_found', depth: 20 } },
      { point: d!, rank: { kind: 'unknown', reason: 'captcha' } },
    ]
    expect(summarizeGrid(cells)).toEqual({
      points: 4,
      ranked: 2,
      notFound: 1,
      unknown: 1,
      averageRank: 3.5,
      top3Share: 0.33,
      best: 1,
    })
  })
})

describe('opening a business the tools were given', () => {
  it('builds the Maps address for each kind of reference', () => {
    expect(businessRefUrl({ cid: '2946633002421908862' })).toEqual({
      kind: 'place',
      url: 'https://www.google.com/maps?cid=2946633002421908862',
    })
    expect(businessRefUrl({ placeId: 'ChIJP0warDDowokRfvXMkBqL5Cg' }).url).toBe(
      'https://www.google.com/maps/place/?q=place_id:ChIJP0warDDowokRfvXMkBqL5Cg',
    )
    expect(businessRefUrl({ name: 'Nyack Plumbing Co', city: 'West Nyack, NY' })).toEqual({
      kind: 'search',
      url: 'https://www.google.com/maps/search/Nyack+Plumbing+Co+West+Nyack%2C+NY',
      name: 'Nyack Plumbing Co',
    })
    expect(businessRefUrl({ mapsUrl: 'https://maps.app.goo.gl/abc' }).kind).toBe('place')
  })

  it('refuses a link that is not Google Maps, and a CID that is not a number', () => {
    expect(() => businessRefUrl({ mapsUrl: 'https://evil.example/maps' })).toThrow('Not a Google')
    expect(() => businessRefUrl({ cid: '0x12' })).toThrow('decimal digits')
  })
})
