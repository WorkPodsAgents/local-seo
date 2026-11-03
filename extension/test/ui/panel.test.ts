import { describe, expect, it } from 'vitest'
import { bandOf } from '../../src/ui/charts/heatmap'
import { filledMonths } from '../../src/ui/charts/review-charts'
import { siteText } from '../../src/ui/parts'
import { nearOf } from '../../src/ui/rankings/teleport'
import { mapsUrlFor, searchPageQuery } from '../../src/ui/search-notice'

describe('what the panel shows', () => {
  it('Teleport reads "lat, lng" as a point and anything else as a place name', () => {
    expect(nearOf(' 53.8008, -1.5491 ')).toEqual({ lat: 53.8008, lng: -1.5491 })
    expect(nearOf('Leeds, UK')).toBe('Leeds, UK')
  })

  it('the heatmap keeps not found and not read apart from every rank', () => {
    expect(bandOf({ kind: 'ranked', rank: 3 })).toBe('top')
    expect(bandOf({ kind: 'ranked', rank: 4 })).toBe('page')
    expect(bandOf({ kind: 'ranked', rank: 11 })).toBe('deep')
    expect(bandOf({ kind: 'not_found', depth: 20 })).toBe('absent')
    expect(bandOf({ kind: 'unknown', reason: 'unusual traffic' })).toBe('unknown')
  })

  it('a month with no reviews shows as a gap in the trend, not as a missing bar', () => {
    const months = filledMonths([
      { month: '2025-11', count: 2, averageRating: 5 },
      { month: '2026-02', count: 1, averageRating: 4 },
    ])
    expect(months.map((entry) => entry.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect('count' in (months[1] ?? {})).toBe(false)
  })

  it('on a Google results page, the same search is offered in Maps', () => {
    const query = searchPageQuery('https://www.google.com/search?q=dentist+austin+tx&hl=en')
    expect(query).toBe('dentist austin tx')
    expect(mapsUrlFor(query ?? null)).toBe('https://www.google.com/maps/search/dentist+austin+tx')
    expect(searchPageQuery('https://www.google.com/search?tbm=lcl&q=plumber')).toBe('plumber')
    expect(searchPageQuery('https://www.google.com/maps/search/dentist')).toBeUndefined()
    expect(mapsUrlFor(null)).toBe('https://www.google.com/maps')
  })

  it('a website shows without its tracking parameters', () => {
    expect(siteText('http://www.southaustindentisttx.com/?utm_source=gbp')).toBe(
      'southaustindentisttx.com',
    )
  })
})
