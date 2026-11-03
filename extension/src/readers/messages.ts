// The messages the service worker and the side panel send straight to the content script. One map types both ends, so a renamed field fails the build instead of a read. They
// never carry a secret: a page only ever gets a list size.
import type { Business, LocalResults, Post, Review } from '@local-seo/core/business'
import type { ApiReply } from '../shared/api'
import type { CapturedPage } from './dev-capture'
import type { ListStop, ScrolledList } from './paging'

export interface ContentMessages {
  /** The place open in Maps, or null when the page shows no place. */
  'maps:readPlace': { request: Record<string, never>; response: Business | null }
  /** The Maps results list, scrolled until `max` results load; null off a results page. */
  'maps:readResults': {
    request: { max: number }
    response: { results: LocalResults; stoppedBy: ListStop } | null
  }
  /** Opens the place's Reviews tab and waits for its reviews; false when it shows none. */
  'maps:openReviews': { request: Record<string, never>; response: boolean }
  /** Sorts the open Reviews tab by Newest; false when Maps' default order stays. */
  'maps:sortReviews': { request: Record<string, never>; response: boolean }
  /** Reviews of the open place, scrolled until `max` load. The reviews tab must be open. */
  'maps:readReviews': { request: { max: number }; response: ScrolledList<Review> }
  /** Posts ("Updates") of the open place, scrolled until `max` load. */
  'maps:readPosts': { request: { max: number }; response: ScrolledList<Post> }
  /** The language the page is drawn in (`hl`, else the document's `lang`); null if unnamed. */
  'maps:language': { request: Record<string, never>; response: { language: string | null } }
  /** Labels every result card on the page with its primary category. */
  'overlay:show': { request: Record<string, never>; response: { labelled: number } }
  'overlay:hide': { request: Record<string, never>; response: { removed: number } }
  /** The page as the browser holds it, for saving reader fixtures. Development builds only. */
  'dev:captureFixture': { request: Record<string, never>; response: CapturedPage }
}

export type ContentMessageType = keyof ContentMessages

export interface ContentMessage<T extends ContentMessageType = ContentMessageType> {
  readonly type: T
  readonly payload: ContentMessages[T]['request']
}

export type ContentHandlers = {
  readonly [T in ContentMessageType]?: (
    payload: ContentMessages[T]['request'],
  ) => ContentMessages[T]['response'] | Promise<ContentMessages[T]['response']>
}

/**
 * Answers the messages a content script handles with an `ApiReply`, so a reader that throws
 * reaches the caller as an error instead of a silent `undefined`. Messages the script does not
 * handle are left for the other script that may share the tab.
 */
export function serveContentMessages(handlers: ContentHandlers): void {
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isMessageShape(message) || !Object.hasOwn(handlers, message.type)) return undefined
    // The map above ties each handler to its own message type; the lookup loses that pairing.
    const handler = handlers[message.type as ContentMessageType] as (payload: unknown) => unknown
    Promise.resolve()
      .then(() => handler(message.payload))
      .then(
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

function isMessageShape(message: unknown): message is { type: string; payload: unknown } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    typeof message.type === 'string'
  )
}
