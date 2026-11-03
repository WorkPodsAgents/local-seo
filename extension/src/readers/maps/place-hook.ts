// Both ends of the hand-over of Maps' place data (`/maps/preview/place`) to the Maps reader.
// Content scripts run in an isolated world and cannot see the page's network responses, and the
// place data is fetched once, when the panel opens. So a tiny script in the page's own world
// keeps the last few place responses, and the reader asks it for one over `postMessage`.
// Privacy: it keeps only place data Maps already fetched to show the user, in this tab's memory,
// and hands it to nothing but the reader; it never changes a request or response.
import { featureIdFromUrl } from '../google-urls'

const CHANNEL = 'local-seo:maps-place-data'
const PLACE_PATH = '/maps/preview/place'
// A person opens a handful of places per page; more than this is old and only costs memory.
const CACHE_SIZE = 20

/** The parts of the page's window the hook touches, so tests can hand it a fake. */
export interface PageWindow {
  fetch: typeof fetch
  readonly XMLHttpRequest: { readonly prototype: XMLHttpRequest }
  readonly location: { readonly href: string; readonly origin: string }
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  postMessage(message: unknown, targetOrigin: string): void
}

interface BodyRequest {
  readonly channel: typeof CHANNEL
  readonly kind: 'request'
  readonly id: string
  readonly featureId: string
}

interface BodyReply {
  readonly channel: typeof CHANNEL
  readonly kind: 'reply'
  readonly id: string
  readonly body: string | null
}

/** Runs in the page's world at document start, before Maps sends its first request. */
export function installPlaceHook(page: PageWindow): void {
  const bodies = new Map<string, string>()
  const keep = (url: string, body: string): void => {
    const featureId = featureIdFromUrl(url)
    if (featureId === null) return
    bodies.delete(featureId)
    bodies.set(featureId, body)
    for (const oldest of bodies.keys()) {
      if (bodies.size <= CACHE_SIZE) break
      bodies.delete(oldest)
    }
  }
  const isPlace = (url: string): boolean => {
    try {
      const parsed = new URL(url, page.location.href)
      return parsed.origin === page.location.origin && parsed.pathname === PLACE_PATH
    } catch {
      return false
    }
  }

  const pageFetch = page.fetch
  page.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
    const response = pageFetch.apply(this, args)
    const url = requestUrl(args[0])
    if (url !== null && isPlace(url)) {
      // A clone leaves the page's own response unread; any failure here stays here.
      response.then((res) => res.clone().text()).then((body) => keep(url, body), ignore)
    }
    return response
  }

  // A request object can be opened again for another address, so the address is kept per open.
  const placeUrls = new WeakMap<XMLHttpRequest, string>()
  const listening = new WeakSet<XMLHttpRequest>()
  const onLoad = function (this: XMLHttpRequest): void {
    const url = placeUrls.get(this)
    try {
      const textBody = this.responseType === '' || this.responseType === 'text'
      if (url !== undefined && textBody && this.status === 200) keep(url, this.responseText)
    } catch {
      // Reading a response must never throw into Maps.
    }
  }
  const proto = page.XMLHttpRequest.prototype
  const open = proto.open as (this: XMLHttpRequest, ...args: unknown[]) => void
  proto.open = function (this: XMLHttpRequest, ...args: unknown[]) {
    const url = typeof args[1] === 'string' || args[1] instanceof URL ? String(args[1]) : ''
    if (isPlace(url)) {
      placeUrls.set(this, url)
      if (!listening.has(this)) this.addEventListener('load', onLoad)
      listening.add(this)
    } else {
      placeUrls.delete(this)
    }
    open.apply(this, args)
  } as XMLHttpRequest['open']

  page.addEventListener('message', (event) => {
    if ((event.source as unknown) !== page || event.origin !== page.location.origin) return
    const request = event.data as Partial<BodyRequest> | null
    if (request?.channel !== CHANNEL || request.kind !== 'request') return
    if (typeof request.id !== 'string' || typeof request.featureId !== 'string') return
    const body = bodies.get(request.featureId.toLowerCase()) ?? null
    const reply: BodyReply = { channel: CHANNEL, kind: 'reply', id: request.id, body }
    page.postMessage(reply, page.location.origin)
  })
}

/**
 * Asked from the isolated reader: the place body Maps fetched for `featureId`, or null when the
 * hook kept none (Maps had loaded before the extension, or the place came with the page).
 */
export function placeBodyFor(
  page: PageWindow,
  featureId: string,
  timeoutMs = 500,
): Promise<string | null> {
  const id = crypto.randomUUID()
  return new Promise((resolve) => {
    const done = (body: string | null): void => {
      clearTimeout(timer)
      page.removeEventListener('message', listen)
      resolve(body)
    }
    const listen = (event: MessageEvent): void => {
      if ((event.source as unknown) !== page || event.origin !== page.location.origin) return
      const reply = event.data as Partial<BodyReply> | null
      if (reply?.channel !== CHANNEL || reply.kind !== 'reply' || reply.id !== id) return
      done(typeof reply.body === 'string' ? reply.body : null)
    }
    const timer = setTimeout(() => done(null), timeoutMs)
    page.addEventListener('message', listen)
    const request: BodyRequest = { channel: CHANNEL, kind: 'request', id, featureId }
    page.postMessage(request, page.location.origin)
  })
}

function requestUrl(input: RequestInfo | URL): string | null {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return typeof input?.url === 'string' ? input.url : null
}

function ignore(): void {}
