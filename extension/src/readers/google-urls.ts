// Identifiers and the search context that Google Maps and Search put in their own addresses. They
// are read from the URL first because it is the one part of the page Google cannot restyle, so a
// profile keeps its ids even when a reader's page hooks break.
import type { BusinessIds, LatLng } from '@local-seo/core/business'

/** The map view in a Maps address, `@lat,lng,15z`; zoom is null for metre views (`1234m`). */
export interface MapView extends LatLng {
  readonly zoom: number | null
}

// Maps encodes place data as `!<field><type><value>` in the `data=` path segment: `!1s` holds the
// feature id or place id, `!19s` the place id, `!16s` the Knowledge Graph id and `!3d`/`!4d` the
// place's own coordinates. A place inside a building also carries the building's feature id
// under `!5s`, before its own, so the place's `!1s` id is preferred over the first one seen.
const FEATURE_HEX = '0x[0-9a-f]{1,16}:0x[0-9a-f]{1,16}'
const OWN_FEATURE_ID = new RegExp(`!1s(${FEATURE_HEX})`, 'i')
const FEATURE_ID = new RegExp(FEATURE_HEX, 'i')
const PLACE_POINT = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
// A place opened from a search keeps the query in `!2m1!1s<query>`; its list stays on the page.
const PLACE_QUERY = /!2m1!1s([^!]+)/
const PLACE_ID = /(?:!19s|!1s|place_id[:=]|query_place_id=)(ChIJ[\w-]+)/
const KG_ID = /(?:!16s|kgmid=)(\/[gm]\/[\w-]+)/
const CID = /[?&](?:cid|ludocid)=(\d+)/
const VIEW = /\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)([zm]))?/

/** Every id the address carries; the CID falls back to the one encoded in the feature id. */
export function idsFromUrl(url: string): BusinessIds {
  const featureId = featureIdFromUrl(url)
  return {
    placeId: placeIdFromUrl(url),
    cid: cidFromUrl(url) ?? (featureId === null ? null : cidFromFeatureId(featureId)),
    kgId: kgIdFromUrl(url),
    featureId,
  }
}

/** The decimal customer id from `?cid=` (Maps) or `ludocid=` (Search). */
export function cidFromUrl(url: string): string | null {
  return CID.exec(url)?.[1] ?? null
}

/** The hex feature id `0x…:0x…`, from the `data=` segment or an `ftid=` parameter. */
export function featureIdFromUrl(url: string): string | null {
  const text = decoded(url)
  const id = OWN_FEATURE_ID.exec(text)?.[1] ?? FEATURE_ID.exec(text)?.[0]
  return id?.toLowerCase() ?? null
}

/** The place's own pin, `!3d<lat>!4d<lng>`, which stays put when the `@` map view moves. */
export function placePointFromUrl(url: string): LatLng | null {
  const match = PLACE_POINT.exec(url)
  if (match === null) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  return Math.abs(lat) > 90 || Math.abs(lng) > 180 ? null : { lat, lng }
}

/** The second half of a feature id is the CID in hex, so a Maps link alone yields the CID. */
export function cidFromFeatureId(featureId: string): string | null {
  const hex = featureId.split(':')[1]
  if (hex === undefined || !/^0x[0-9a-f]+$/i.test(hex)) return null
  return BigInt(hex).toString()
}

export function placeIdFromUrl(url: string): string | null {
  return PLACE_ID.exec(decoded(url))?.[1] ?? null
}

/** The Knowledge Graph id: `/g/…` for newer entities, `/m/…` for those from Freebase. */
export function kgIdFromUrl(url: string): string | null {
  return KG_ID.exec(decoded(url))?.[1] ?? null
}

/**
 * The query the user searched: `q=` on Search, the `/maps/search/<query>/` path on Maps, or the
 * search a Maps place was opened from. A place opened directly has no query, so it gives null.
 */
export function queryFromUrl(url: string): string | null {
  const parsed = parse(url)
  if (parsed === null) return null
  // `query=` is the Maps URLs API form (`/maps/search/?api=1&query=…`).
  const q = parsed.searchParams.get('q') ?? parsed.searchParams.get('query')
  if (q !== null && q.trim() !== '') return q.trim()
  const searched = pathSegmentAfter(parsed, 'search')
  if (searched !== null || pathSegmentAfter(parsed, 'place') === null) return searched
  const fromPlace = PLACE_QUERY.exec(parsed.pathname)?.[1]
  return fromPlace === undefined ? null : decoded(fromPlace.replace(/\+/g, ' ')).trim() || null
}

/**
 * Which Google Search page the address is: the Local Finder (`tbm=lcl`), an ordinary results page
 * that may hold a local pack, or null for anything else, Maps included.
 */
export function searchPageOf(url: string): 'local_finder' | 'results' | null {
  const parsed = parse(url)
  if (parsed === null || parsed.pathname !== '/search') return null
  if (!/(^|\.)google\.[a-z.]+$/.test(parsed.hostname)) return null
  return parsed.searchParams.get('tbm') === 'lcl' ? 'local_finder' : 'results'
}

/** The business name in a Maps place address, `/maps/place/<name>/…`. */
export function placeNameFromUrl(url: string): string | null {
  const parsed = parse(url)
  return parsed === null ? null : pathSegmentAfter(parsed, 'place')
}

export function mapViewFromUrl(url: string): MapView | null {
  const match = VIEW.exec(url)
  if (match === null) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  const zoom = match[4] === 'z' ? Number(match[3]) : null
  return { lat, lng, zoom }
}

function pathSegmentAfter(parsed: URL, marker: string): string | null {
  const parts = parsed.pathname.split('/')
  const at = parts.indexOf(marker)
  if (at < 1 || parts[at - 1] !== 'maps') return null
  const segment = parts[at + 1]
  if (segment === undefined || segment === '' || segment.startsWith('@')) return null
  // Maps writes spaces as `+` in the path, where URL decoding leaves them alone.
  return decoded(segment.replace(/\+/g, ' ')).trim() || null
}

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function decoded(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}
