// Fetching a page the way a crawler running no JavaScript does, following redirects by hand so
// each hop and any loop is on record.
import type { Fetcher, FetchResponse, HtmlParser } from '../io'
import type { PageSnapshot, RedirectHop, Vitals } from '../model'
import { absolute } from './dom'

/** Browsers and Googlebot give up after about this many. */
const MAX_REDIRECTS = 10
const REDIRECTS = new Set([301, 302, 303, 307, 308])

export async function fetchSnapshot(
  fetcher: Fetcher,
  parse: HtmlParser,
  url: string,
): Promise<PageSnapshot> {
  const hops: RedirectHop[] = []
  const visited = new Set<string>()
  let next = url
  for (;;) {
    const response = await fetcher.fetch({ url: next })
    const location = lowerCased(response)['location']
    const target =
      REDIRECTS.has(response.status) && location ? absolute(location, response.url) : null
    if (target === null) return snapshotOf(response, url, hops, parse)
    hops.push({ url: response.url, status: response.status, location: target })
    visited.add(response.url)
    // A loop or an endless chain ends here; the last 3xx answer stands as the page's.
    if (visited.has(target) || hops.length >= MAX_REDIRECTS) {
      return snapshotOf(response, url, hops, parse)
    }
    next = target
  }
}

function snapshotOf(
  response: FetchResponse,
  requestedUrl: string,
  redirects: readonly RedirectHop[],
  parse: HtmlParser,
): PageSnapshot {
  return {
    url: response.url,
    requestedUrl,
    status: response.status,
    headers: lowerCased(response),
    redirects,
    rawHtml: response.body,
    raw: parse(response.body, response.url),
    rendered: null,
    vitals: null,
  }
}

/** The contract says keys arrive lower-cased; a runtime that slips is caught here. */
function lowerCased(response: FetchResponse): Record<string, string> {
  return Object.fromEntries(
    Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]),
  )
}

export function addRendered(
  snapshot: PageSnapshot,
  renderedHtml: string,
  parse: HtmlParser,
  vitals: Vitals | null,
): PageSnapshot {
  return { ...snapshot, rendered: parse(renderedHtml, snapshot.url), vitals }
}
