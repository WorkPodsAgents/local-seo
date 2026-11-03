// Maps and Search URLs carry the map centre and every id Google uses for a place. Reading them
// lets a pasted link identify a business, and building them lets Teleport open Maps at a point.
import type { BusinessIds, LatLng } from '../business'

/** A Maps search for `query` seen from `at` at `zoom` (Maps accepts 3 to 21). */
export function mapsSearchUrl(query: string, at: LatLng, zoom: number): string {
  const q = encodeURIComponent(query.trim()).replace(/%20/g, '+')
  return `https://www.google.com/maps/search/${q}/@${fixed(at.lat)},${fixed(at.lng)},${zoom}z`
}

function fixed(value: number): string {
  return String(Math.round(value * 1e7) / 1e7)
}

export interface MapsUrlParts {
  readonly center: LatLng | null
  /** Null when the URL gives the view in metres ("1234m") or not at all. */
  readonly zoom: number | null
  readonly ids: BusinessIds
  /** The search text or place name in the path or `q`, decoded. */
  readonly query: string | null
}

const FEATURE = /0x[0-9a-f]+:0x[0-9a-f]+/i

export function parseMapsUrl(url: string): MapsUrlParts | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const full = decodeSafe(parsed.pathname + parsed.search + parsed.hash)
  const params = parsed.searchParams
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)z)?/.exec(full)
  const featureId = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i.exec(full)?.[1] ?? featureParam(params)
  return {
    center: view === null ? null : { lat: Number(view[1]), lng: Number(view[2]) },
    zoom: view?.[3] === undefined ? null : Number(view[3]),
    ids: {
      placeId:
        /!19s(ChIJ[\w-]+)/.exec(full)?.[1] ??
        /place_id:(ChIJ[\w-]+)/.exec(full)?.[1] ??
        params.get('query_place_id') ??
        params.get('placeid') ??
        null,
      cid: params.get('cid') ?? params.get('ludocid') ?? cidOf(featureId),
      kgId: /(?:!16s|kgmid=)(\/g\/[\w-]+)/.exec(full)?.[1] ?? null,
      featureId,
    },
    query: queryOf(parsed),
  }
}

function featureParam(params: URLSearchParams): string | null {
  const ftid = params.get('ftid')
  return ftid !== null && FEATURE.test(ftid) ? ftid : null
}

/** The second half of a feature id is the CID in hex. */
function cidOf(featureId: string | null): string | null {
  const hex = featureId?.split(':')[1]
  if (hex === undefined) return null
  try {
    return BigInt(hex).toString()
  } catch {
    return null
  }
}

function queryOf(url: URL): string | null {
  const inPath = /\/maps\/(?:search|place)\/([^/@]+)/.exec(url.pathname)?.[1]
  const raw = inPath ?? url.searchParams.get('q')
  if (raw === undefined || raw === null) return null
  const text = decodeSafe(raw.replace(/\+/g, ' ')).trim()
  return text === '' ? null : text
}

function decodeSafe(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}
