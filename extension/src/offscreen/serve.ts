import type { Fetcher, FetchResponse } from '@open-agent-ready/core'
import { fetchPage } from '@open-agent-ready/core/page'
import { checkWebsite } from '@local-seo/core/nap'
import type { ApiReply } from '../shared/api'
import { extensionFetcher } from '../background/fetcher'
import { isOffscreenCall, type OffscreenOp, type OffscreenOps } from '../shared/offscreen'

type Ops = { [K in OffscreenOp]: (input: OffscreenOps[K]['in']) => Promise<OffscreenOps[K]['out']> }

export const OPS: Ops = {
  async website({ business, url }) {
    const snapshot = await fetchPage(relayFetcher, parseHtml, url)
    return { website: checkWebsite(business, snapshot), status: snapshot.status }
  },
}

/** Answers the service worker's calls; every other message on the channel is someone else's. */
export function serve(): void {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isOffscreenCall(message) || sender.id !== browser.runtime.id) return undefined
    const op = OPS[message.op] as (input: unknown) => Promise<unknown>
    op(message.input).then(
      (result) => sendResponse({ ok: true, result } satisfies ApiReply),
      (error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies ApiReply),
    )
    return true
  })
}

/** Sends each request to the service worker, which alone can read redirect hops. */
const relayFetcher: Fetcher = {
  async fetch(request) {
    if (import.meta.env.FIREFOX) return extensionFetcher.fetch(request)
    const reply = (await browser.runtime.sendMessage({
      type: 'net:fetch',
      payload: request,
    })) as ApiReply
    if (!reply.ok) throw new Error(reply.error)
    // The service worker answers net:fetch with its Fetcher's FetchResponse.
    return reply.result as FetchResponse
  },
}

function parseHtml(html: string, url: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // Relative links resolve against the page's URL, as they do in the browser tab.
  if (doc.querySelector('base[href]') === null) {
    const base = doc.createElement('base')
    base.href = url
    doc.head.prepend(base)
  }
  return doc
}
