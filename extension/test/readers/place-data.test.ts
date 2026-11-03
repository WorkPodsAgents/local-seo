// The `/maps/preview/place` response Maps fetched, signed out, for South Austin Dentist; see
// test/fixtures. The ids are the ones the panel reader takes from the same page.
import { isMissing } from '@local-seo/core/business'
import { describe, expect, it } from 'vitest'
import { parsePlaceData } from '../../src/readers/maps/place-data'
import { savedPlaceData } from './maps-fixture'

const FEATURE_ID = '0x865b4b5e859f967f:0x38deff12e0bdefcb'

describe("reading Maps' place data", () => {
  it('reads every category, the description and the owner the page leaves out', () => {
    const data = parsePlaceData(savedPlaceData().body, FEATURE_ID)
    expect(data).toMatchObject({
      name: 'South Austin Dentist',
      categories: ['Dentist', 'Emergency dental service'],
      description: expect.stringMatching(/gentle and caring demeanor/),
      claimed: true,
      ids: {
        placeId: 'ChIJf5afhV5LW4YRy--94BL_3jg',
        cid: '4097993167498768331',
        kgId: '/g/11kh_3g55b',
        featureId: FEATURE_ID,
      },
    })
  })

  it('reads the contact details, pin, rating, hours and attributes', () => {
    const data = parsePlaceData(savedPlaceData().body, FEATURE_ID)
    expect(data).toMatchObject({
      phone: '(737) 437-3801',
      website: expect.stringMatching(/^http:\/\/southaustindentisttx\.com\/\?utm_source=gbp/),
      location: { lat: 30.237298499999998, lng: -97.7902045 },
      rating: 5,
      reviewCount: 181,
      hours: {
        intervals: ['mon', 'tue', 'wed', 'thu'].map((day) => ({
          day,
          opens: '08:00',
          closes: '16:00',
        })),
        open24h: [],
      },
      attributes: [
        {
          group: 'Accessibility',
          values: expect.arrayContaining(['Has wheelchair accessible entrance']),
        },
      ],
    })
  })

  it('reads nothing from a response for another place or a body that is not place data', () => {
    const body = savedPlaceData().body
    expect(parsePlaceData(body, '0x1:0x2')).toBeNull()
    expect(parsePlaceData('<html></html>', FEATURE_ID)).toBeNull()
  })

  it('says a field is unreadable when Maps moves it, instead of reading a wrong value', () => {
    const [prefix, json] = splitBody(savedPlaceData().body)
    const data = JSON.parse(json) as unknown[][]
    const place = data[6] as unknown[]
    place[13] = 'Dentist'
    place[203] = [['Monday', 1, null, [['8 AM–4 PM', 'eight to four']], 0, 1]]
    const moved = parsePlaceData(prefix + JSON.stringify(data), FEATURE_ID)
    expect(moved !== null && isMissing(moved.categories)).toBe(true)
    expect(moved?.hours).toMatchObject({ missing: true, reason: expect.stringMatching(/cannot/) })
  })
})

function splitBody(body: string): [string, string] {
  const start = body.indexOf('\n') + 1
  return [body.slice(0, start), body.slice(start)]
}
