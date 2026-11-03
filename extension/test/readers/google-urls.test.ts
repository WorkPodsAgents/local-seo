// The addresses below are written by hand in the shapes Maps and Search use; no Google page was
// fetched to make them.
import { describe, expect, it } from 'vitest'
import {
  cidFromFeatureId,
  idsFromUrl,
  mapViewFromUrl,
  placeNameFromUrl,
  placePointFromUrl,
  queryFromUrl,
  searchPageOf,
} from '../../src/readers/google-urls'

const PLACE =
  "https://www.google.com/maps/place/Joe's+Pizza+%26+Pasta/@40.7305991,-73.9890092,17z/" +
  'data=!3m1!4b1!4m6!3m5!1s0x89c2599a8d5e7c3d:0x5B1A8E6F2C3D4E5F!8m2!3d40.73!4d-73.98' +
  '!16s%2Fg%2F1tf7ykl3?entry=ttu'
const PLACE_CID = '6564716014980648543'
const PLACE_ID = 'ChIJ8Q2WSpJZwokRQz-bYYgEskM'

describe('ids in a Maps or Search address', () => {
  it('reads the feature id, the KG id and the CID inside the feature id from a place', () => {
    expect(idsFromUrl(PLACE)).toEqual({
      placeId: null,
      cid: PLACE_CID,
      kgId: '/g/1tf7ykl3',
      featureId: '0x89c2599a8d5e7c3d:0x5b1a8e6f2c3d4e5f',
    })
  })

  it('reads the place id from the !19s data field and the Maps URLs API', () => {
    const data = `https://www.google.com/maps/place/Joe's+Pizza/data=!4m2!3m1!19s${PLACE_ID}`
    const api = `https://www.google.com/maps/search/?api=1&query=Pizza&query_place_id=${PLACE_ID}`
    expect(idsFromUrl(data).placeId).toBe(PLACE_ID)
    expect(idsFromUrl(api).placeId).toBe(PLACE_ID)
  })

  it('prefers the decimal CID a cid or ludocid parameter gives', () => {
    expect(idsFromUrl('https://maps.google.com/?cid=12345678901234567890').cid).toBe(
      '12345678901234567890',
    )
    const search = 'https://www.google.com/search?q=joes+pizza&ludocid=42&kgmid=/m/0abc12'
    expect(idsFromUrl(search)).toEqual({
      placeId: null,
      cid: '42',
      kgId: '/m/0abc12',
      featureId: null,
    })
  })

  it('gives every id as null for an address that carries none or is not an address', () => {
    const none = { placeId: null, cid: null, kgId: null, featureId: null }
    expect(idsFromUrl('https://www.google.com/maps/@40.7,-73.9,15z')).toEqual(none)
    expect(idsFromUrl('not a url')).toEqual(none)
  })

  it("prefers the place's own !1s feature id over the building's !5s one before it", () => {
    const inBuilding =
      'https://www.google.com/maps/place/A/data=!3m1!5s0x1:0xa!4m6!3m5!1s0x2:0xb!8m2!3d1!4d2'
    expect(idsFromUrl(inBuilding)).toMatchObject({ featureId: '0x2:0xb', cid: '11' })
  })

  it('refuses a feature id with no hex second half', () => {
    expect(cidFromFeatureId('0x89c2')).toBeNull()
  })
})

describe('the search context in an address', () => {
  it('reads the query from a Maps search path and from a Search q parameter', () => {
    const maps = 'https://www.google.com/maps/search/plumber+in+austin/@30.2672,-97.7431,13z'
    expect(queryFromUrl(maps)).toBe('plumber in austin')
    expect(queryFromUrl('https://www.google.com/search?q=dentist+near+me&tbm=lcl')).toBe(
      'dentist near me',
    )
  })

  it('gives no query for a place page, and the place name decoded from its path', () => {
    expect(queryFromUrl(PLACE)).toBeNull()
    expect(placeNameFromUrl(PLACE)).toBe("Joe's Pizza & Pasta")
    expect(placeNameFromUrl('https://www.google.com/maps/search/pizza/')).toBeNull()
  })

  it('reads the search a place was opened from, and the place pin apart from the view', () => {
    const opened =
      'https://www.google.com/maps/place/A/@30.1,-98.0,11z/data=!4m10!1m2!2m1!1sdentist+austin+tx' +
      '!3m6!1s0x1:0x2!8m2!3d30.2372985!4d-97.7902045'
    expect(queryFromUrl(opened)).toBe('dentist austin tx')
    expect(placePointFromUrl(opened)).toEqual({ lat: 30.2372985, lng: -97.7902045 })
    expect(placePointFromUrl(PLACE)).toEqual({ lat: 40.73, lng: -73.98 })
    expect(placePointFromUrl('https://www.google.com/maps/@40.7,-73.9,15z')).toBeNull()
  })

  it('tells the Local Finder from an ordinary results page, and Maps from both', () => {
    expect(searchPageOf('https://www.google.com/search?q=dentist&tbm=lcl')).toBe('local_finder')
    expect(searchPageOf('https://www.google.co.uk/search?q=dentist')).toBe('results')
    expect(searchPageOf('https://www.google.com/maps/search/dentist/')).toBeNull()
    expect(searchPageOf('https://example.com/search?q=dentist')).toBeNull()
  })

  it('reads the map view, with zoom only when the view is zoom-scaled', () => {
    expect(mapViewFromUrl(PLACE)).toEqual({ lat: 40.7305991, lng: -73.9890092, zoom: 17 })
    expect(mapViewFromUrl('https://www.google.com/maps/@40.7,-73.9,1234m/data=!3m1')).toEqual({
      lat: 40.7,
      lng: -73.9,
      zoom: null,
    })
    expect(mapViewFromUrl('https://www.google.com/maps/@95.1,10.2,12z')).toBeNull()
    expect(mapViewFromUrl('https://www.google.com/search?q=pizza')).toBeNull()
  })
})
