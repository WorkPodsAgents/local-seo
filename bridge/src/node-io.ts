// The core's IO seams for Node: the website check runs here when no extension is connected, and
// fetches with Node's fetch and parses with linkedom where the extension uses its service worker
// and DOMParser.
import { parseHTML } from 'linkedom'
import type { FetchRequest, FetchResponse, Fetcher, HtmlParser } from '@open-agent-ready/core'

export const USER_AGENT = 'LocalSEO/0.1 (+https://workpods.ai)'

/** A slow site must not hang a CI job; a page that takes longer is reported as unreachable. */
const REQUEST_TIMEOUT_MS = 20_000

export const nodeFetcher: Fetcher = {
  async fetch(request: FetchRequest): Promise<FetchResponse> {
    const response = await fetch(request.url, {
      redirect: 'manual',
      headers: {
        accept: request.accept ?? 'text/html',
        'user-agent': request.userAgent ?? USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
    return { url: request.url, status: response.status, headers, body: await response.text() }
  },
}

export const parseHtml: HtmlParser = (html) => parseHTML(html).document
