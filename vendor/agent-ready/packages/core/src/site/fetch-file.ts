// Reads one site file through the Fetcher seam, which never follows redirects, so the hops are
// followed here. A thrown fetch is an unreachable file, which is a fact, never a crash.
import type { FetchResponse, Fetcher } from '../io'

/** robots.txt readers must follow at least five hops (RFC 9309); files use the same cap. */
const MAX_HOPS = 5

/** Where a file read ended: `response` is null when no answer came. */
export interface FileAnswer {
  readonly requested: string
  readonly response: FetchResponse | null
  /** The URL that answered, after redirects. */
  readonly url: string
}

export async function fetchFile(
  fetcher: Fetcher,
  url: string,
  accept: string,
): Promise<FileAnswer> {
  let current = url
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    let response: FetchResponse
    try {
      response = await fetcher.fetch({ url: current, accept })
    } catch {
      return { requested: url, response: null, url: current }
    }
    const location = response.headers['location']
    if (response.status < 300 || response.status >= 400 || location === undefined) {
      return { requested: url, response, url: current }
    }
    const next = resolve(current, location)
    if (next === null) return { requested: url, response, url: current }
    current = next
  }
  return { requested: url, response: null, url: current }
}

/** `href` resolved against `base`, fragment removed; null when it is no URL. */
export function resolve(base: string, href: string): string | null {
  try {
    const url = new URL(href.trim(), base)
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}

/** The response's media type, lower-cased, without parameters. */
export function mediaType(response: FetchResponse): string | null {
  const type = response.headers['content-type']?.split(';')[0]?.trim().toLowerCase()
  return type === undefined || type === '' ? null : type
}
