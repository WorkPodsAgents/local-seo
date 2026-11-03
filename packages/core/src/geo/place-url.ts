// The Maps address that opens a business the tools were given, so the extension can read it in a
// background tab. Ids open the place itself; a name opens a search the caller picks from.
import type { BusinessRef } from '../bridge'

const MAPS = 'https://www.google.com/maps'

/** Google's own Maps hosts, and its short-link hosts, which redirect to them. */
const MAPS_HOST = /^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$|^(maps\.app\.)?goo\.gl$/

export type RefUrl =
  /** The address opens the place panel. */
  | { readonly kind: 'place'; readonly url: string }
  /** The address opens a search whose results hold the place, or Maps jumps to it. */
  | { readonly kind: 'search'; readonly url: string; readonly name: string }

export function businessRefUrl(ref: BusinessRef): RefUrl {
  if ('mapsUrl' in ref) {
    const url = parsed(ref.mapsUrl)
    if (url === null || url.protocol !== 'https:' || !MAPS_HOST.test(url.hostname)) {
      throw new Error(`Not a Google Maps link: ${ref.mapsUrl}`)
    }
    return { kind: 'place', url: url.toString() }
  }
  if ('cid' in ref) {
    if (!/^\d+$/.test(ref.cid)) throw new Error(`A CID is decimal digits: ${ref.cid}`)
    return { kind: 'place', url: `${MAPS}?cid=${ref.cid}` }
  }
  if ('placeId' in ref) {
    return { kind: 'place', url: `${MAPS}/place/?q=place_id:${encodeURIComponent(ref.placeId)}` }
  }
  return { kind: 'search', url: searchUrl(`${ref.name} ${ref.city}`), name: ref.name }
}

/** A Maps search for a place name ("Leeds, UK"); Maps centres its view on the place it finds. */
export function searchUrl(text: string): string {
  return `${MAPS}/search/${encodeURIComponent(text.trim()).replace(/%20/g, '+')}`
}

/** The place page for a CID, the id every Maps result carries in its feature id. */
export function cidUrl(cid: string): string {
  return `${MAPS}?cid=${cid}`
}

function parsed(text: string): URL | null {
  try {
    return new URL(text)
  } catch {
    return null
  }
}
