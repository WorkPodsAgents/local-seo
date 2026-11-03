// Saved signed-out Maps result lists, captured 2026-11-02; see test/fixtures.
import { describe, expect, it } from 'vitest'
import {
  mapsResultCards,
  mapsResultsFeed,
  readMapsResults,
} from '../../src/readers/maps/read-results'
import { savedMapsPage } from './maps-fixture'

const NOW = new Date('2026-11-03T00:30:00Z')

function resultsIn(name: string) {
  const { document, url } = savedMapsPage(name)
  const read = readMapsResults(document, url, NOW)
  if (read === null) throw new Error(`${name} held no results`)
  return read
}

describe('reading the Maps results list', () => {
  it('reads each card in order with its ids, rating, category and street', () => {
    const read = resultsIn('results-dentist-austin')
    expect(read).toMatchObject({
      surface: 'maps',
      query: 'dentist austin tx',
      from: { lat: 30.2964901, lng: -97.7585524 },
      readAt: NOW.toISOString(),
    })
    expect(read.results).toHaveLength(20)
    expect(read.results[0]).toEqual({
      position: 1,
      sponsored: false,
      name: 'South Austin Dentist',
      ids: {
        placeId: 'ChIJf5afhV5LW4YRy--94BL_3jg',
        cid: '4097993167498768331',
        kgId: '/g/11kh_3g55b',
        featureId: '0x865b4b5e859f967f:0x38deff12e0bdefcb',
      },
      primaryCategory: 'Dentist',
      rating: 5,
      reviewCount: 181,
      address: '3901 S Lamar Blvd Ste 480',
      location: { lat: 30.2372985, lng: -97.7902045 },
    })
    expect(read.results.every((result) => result.location !== null)).toBe(true)
    expect(read.results.map((result) => result.position)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
  })

  it('reads thousands in review counts and no street for a service-area business', () => {
    const results = resultsIn('results-plumber-austin').results
    expect(results[0]).toMatchObject({ name: 'Reliant Plumbing - Austin', reviewCount: 1734 })
    expect(results.find((result) => result.name === 'Plumb Masters, Inc.')).toMatchObject({
      position: 3,
      primaryCategory: 'Plumber',
      address: null,
    })
  })

  it('flags ads and counts organic positions without them', () => {
    // A place opened from a search keeps the list, and the query, on the page.
    const results = resultsIn('about-dentist-austin').results
    expect(
      results.slice(0, 3).map(({ position, sponsored, name }) => [position, sponsored, name]),
    ).toEqual([
      [1, true, 'Groovy Dental'],
      [2, true, 'Cedar Park Periodontics: Dr. Prathima Vemulapalli'],
      [1, false, 'Emergency Dentist of Austin'],
    ])
    expect(results[1]?.primaryCategory).toBe('Dental implants periodontist')
    // An ad's place link carries its pin as well, so ads get a distance too.
    expect(results[0]?.location).toEqual({ lat: 30.467663, lng: -97.761712 })
  })

  it('counts only organic cards toward a depth, so ads never push a rank out of reach', () => {
    const { document, url } = savedMapsPage('about-dentist-austin')
    const cards = readMapsResults(document, url, NOW)
    const organic = cards?.results.filter((result) => !result.sponsored).length
    expect(mapsResultsFeed(document)?.count()).toBe(organic)
  })

  it('finds the scrolling feed and each card with its category for the overlay', () => {
    const { document } = savedMapsPage('results-dentist-austin')
    expect(mapsResultsFeed(document)?.count()).toBe(20)
    const cards = mapsResultCards(document)
    expect(cards).toHaveLength(20)
    expect(cards.map((card) => card.category)).toContain('Cosmetic dentist')
    expect(cards[0]?.element.getAttribute('role')).toBe('article')
  })

  it('reads no results from an address without a query', () => {
    const { document } = savedMapsPage('results-dentist-austin')
    expect(readMapsResults(document, 'https://www.google.com/maps/@30.2,-97.7,12z', NOW)).toBeNull()
  })
})
