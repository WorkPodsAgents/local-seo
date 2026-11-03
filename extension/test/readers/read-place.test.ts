// Saved signed-out Maps pages (Maps' "limited view"), captured 2026-11-02; see test/fixtures.
import { isMissing, type Business, type Known } from '@local-seo/core/business'
import { describe, expect, it } from 'vitest'
import { inEnglish, languageNote, mapsLanguage } from '../../src/readers/maps/language'
import { readMapsPlace } from '../../src/readers/maps/read-place'
import { savedMapsPage, savedPlaceData } from './maps-fixture'

const NOW = new Date('2026-11-03T00:30:00Z')
// The profile's own tracking tags on its website link, kept as the owner set them.
const WEBSITE_TAGS = 'utm_source=gbp&utm_medium=organic&utm_campaign=yext_listing'

function placeIn(name: string, placeBody: string | null = null): Business {
  const { document, url } = savedMapsPage(name)
  const place = readMapsPlace(document, url, NOW, placeBody)
  if (place === null) throw new Error(`${name} held no place`)
  return place
}

/** Rewords the page's text nodes, as Maps draws them in another language. */
function translate(doc: Document, words: Record<string, string>): void {
  for (const element of Array.from(doc.querySelectorAll('*'))) {
    for (const node of Array.from(element.childNodes)) {
      const text = node.nodeType === 3 ? (node.textContent ?? '').trim() : ''
      const german = words[text]
      if (german !== undefined) node.textContent = german
    }
  }
}

function reasonOf<T>(value: Known<T>): { reason: string; absent: boolean } | null {
  return isMissing(value) ? { reason: value.reason, absent: value.absent === true } : null
}

describe('reading a place from its Maps panel', () => {
  it('reads the overview of a storefront business', () => {
    const place = placeIn('place-dentist-austin')
    expect(place).toMatchObject({
      source: 'maps_page',
      readAt: NOW.toISOString(),
      name: 'South Austin Dentist',
      categories: { primary: 'Dentist' },
      address: { formatted: '3901 S Lamar Blvd Ste 480, Austin, TX 78704' },
      location: { lat: 30.2372985, lng: -97.7902045 },
      phone: '(737) 437-3801',
      website: `http://southaustindentisttx.com/?${WEBSITE_TAGS}`,
      rating: 5,
      reviewCount: 181,
      photoCount: 7,
      closure: null,
    })
  })

  it('takes the place id from its own card and the feature id from !1s, not the building', () => {
    expect(placeIn('place-dentist-austin').ids).toEqual({
      placeId: 'ChIJf5afhV5LW4YRy--94BL_3jg',
      cid: '4097993167498768331',
      kgId: '/g/11kh_3g55b',
      featureId: '0x865b4b5e859f967f:0x38deff12e0bdefcb',
    })
  })

  it('reads the week of hours, with closed days left out', () => {
    const hours = placeIn('place-dentist-austin').hours
    const weekday = (day: string) => ({ day, opens: '08:00', closes: '16:00' })
    expect(hours).toEqual({
      intervals: ['mon', 'tue', 'wed', 'thu'].map(weekday),
      open24h: [],
    })
  })

  it('reads lower-case UK times and open-all-day hours', () => {
    const uk = placeIn('place-dentist-manchester-uk')
    expect(uk.hours).toMatchObject({
      intervals: expect.arrayContaining([
        { day: 'sat', opens: '10:00', closes: '16:00' },
        { day: 'mon', opens: '08:00', closes: '20:00' },
      ]),
    })
    expect(uk).toMatchObject({ phone: '0161 834 1643', rating: 4.7, reviewCount: 523 })
    const plumber = placeIn('place-plumber-austin').hours
    expect(plumber).toEqual({
      intervals: [],
      open24h: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    })
  })

  it('gives a service-area business no address, as listed-and-absent', () => {
    const place = placeIn('place-plumber-austin')
    expect(place).toMatchObject({
      name: 'Plumb Masters, Inc.',
      categories: { primary: 'Plumber' },
      phone: '(512) 960-0044',
      website: 'https://m.facebook.com/plumb.masters/',
      rating: 4.8,
      reviewCount: 442,
      photoCount: 959,
    })
    expect(reasonOf(place.address)).toMatchObject({ absent: true })
    expect(reasonOf(place.serviceAreas)).toMatchObject({ absent: false })
  })

  it('says why limited-view and never-shown fields are unknown, without failing them', () => {
    const place = placeIn('place-dentist-austin')
    expect(reasonOf(place.categories.secondary)).toEqual({
      reason: 'Reload the Maps page so Local SEO can read the full profile',
      absent: false,
    })
    expect(reasonOf(place.claimed)?.reason).toMatch(/limited view/)
    expect(reasonOf(place.description)?.reason).toMatch(/limited view/)
    expect(reasonOf(place.attributes)?.reason).toMatch(/About tab/)
  })

  it('reads attributes from the About tab, keeping whether each is a yes', () => {
    const place = placeIn('about-dentist-austin')
    expect(place.attributes).toEqual([
      {
        group: 'Accessibility',
        values: [
          'Offers assisted listening devices',
          'Has assistive hearing loop',
          'Has wheelchair accessible entrance',
          'Has wheelchair accessible parking lot',
          'Has wheelchair accessible restroom',
          'Has wheelchair accessible seating',
        ],
      },
    ])
    expect(reasonOf(place.phone)).toEqual({
      reason: 'the Overview tab of the place is not open',
      absent: false,
    })
    expect(isMissing(place.rating)).toBe(true)
  })

  it('still reads the rating and count from the Reviews tab summary', () => {
    const place = placeIn('reviews-dentist-austin')
    expect(place).toMatchObject({ rating: 5, reviewCount: 181 })
    expect(isMissing(place.categories.primary)).toBe(true)
  })

  it('on a page in German, reads what it can and says why English-only fields are unknown', () => {
    const { document, url } = savedMapsPage('place-dentist-austin')
    const german = url.replace('?hl=en', '')
    document.documentElement.setAttribute('lang', 'de')
    translate(document, {
      '7 Photos': '7 Fotos',
      "You're seeing a limited view of Google Maps.": 'Eingeschränkte Ansicht von Google Maps.',
    })
    expect(mapsLanguage(document, german)).toBe('de')
    expect(mapsLanguage(document, url)).toBe('en')
    expect(languageNote('de')).toMatch(/^Google Maps showed this page in German \(de\)/)
    expect(languageNote('en-GB')).toBeNull()
    expect(new URL(inEnglish(german)).searchParams.get('hl')).toBe('en')

    const place = readMapsPlace(document, german, NOW, null)
    expect(place).toMatchObject({ name: 'South Austin Dentist', reviewCount: 181 })
    expect(reasonOf(place?.photoCount ?? 0)?.reason).toMatch(/in German.*only in English/)
    expect(reasonOf(place?.claimed ?? true)?.reason).toMatch(/in German.*only in English/)
  })

  it('reads no place off a place page', () => {
    const { document, url } = savedMapsPage('results-dentist-austin')
    expect(readMapsPlace(document, url, NOW, savedPlaceData().body)).toBeNull()
  })
})

describe('filling a place from the place data Maps fetched for it', () => {
  it('adds the secondary categories, description and owner the limited view hides', () => {
    const place = placeIn('place-dentist-austin', savedPlaceData().body)
    expect(place).toMatchObject({
      categories: { primary: 'Dentist', secondary: ['Emergency dental service'] },
      description: expect.stringMatching(/^South Austin Dentist offers comprehensive dental/),
      claimed: true,
    })
  })

  it('keeps what the panel shows and adds the address parts only the data splits out', () => {
    const shown = placeIn('place-dentist-austin')
    const place = placeIn('place-dentist-austin', savedPlaceData().body)
    expect(place.ids).toEqual(shown.ids)
    expect(place).toMatchObject({
      phone: shown.phone,
      website: shown.website,
      hours: shown.hours,
      location: shown.location,
      address: {
        formatted: '3901 S Lamar Blvd Ste 480, Austin, TX 78704',
        street: '3901 S Lamar Blvd Ste 480',
        city: 'Austin',
        region: 'Texas',
        postalCode: '78704',
        country: 'US',
      },
    })
  })

  it('fills the fields of a tab that is not open', () => {
    const place = placeIn('about-dentist-austin', savedPlaceData().body)
    expect(place).toMatchObject({ phone: '(737) 437-3801', rating: 5, reviewCount: 181 })
    // The About tab's own attributes stay the ones the panel shows.
    expect(place.attributes).toEqual(placeIn('about-dentist-austin').attributes)
  })

  it('never fills a place from data Maps sent for another place', () => {
    const place = placeIn('place-plumber-austin', savedPlaceData().body)
    expect(reasonOf(place.categories.secondary)?.reason).toMatch(/cannot read/)
    expect(reasonOf(place.description)?.reason).toMatch(/limited view/)
    expect(place.phone).toBe('(512) 960-0044')
  })
})
