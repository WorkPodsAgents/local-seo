// The service worker's (and the panel's) side of the content-script messages: inject the reader
// a message needs into the tab, send it, and wait a bounded time for the answer.
import type { ApiReply } from '../shared/api'
import type { ContentMessageType, ContentMessages } from './messages'

export interface ReadableTab {
  readonly id: number
  readonly url: string
}

// One reader script; on a Search page it serves only the development fixture capture, since
// the local pack and Local Finder readers wait for signed-in captures (docs/ROADMAP.md).
const SCRIPT = '/content-scripts/maps.js'

// Scrolled reads may take the content script's whole step cap (40 x 800 ms) before they answer;
// one-shot reads answer at once, so a long wait there means the page is stuck.
const TIMEOUT_MS = {
  'maps:readPlace': 10_000,
  'maps:readResults': 45_000,
  // The content script gives up on the tab after 8 seconds; this leaves it room to say so.
  'maps:openReviews': 15_000,
  // The content script waits at most 3 s for the menu and 6 s for the list to re-render.
  'maps:sortReviews': 12_000,
  'maps:readReviews': 45_000,
  'maps:readPosts': 45_000,
  'maps:language': 10_000,
  'overlay:show': 10_000,
  'overlay:hide': 10_000,
  'dev:captureFixture': 10_000,
} as const satisfies Record<ContentMessageType, number>

/**
 * Asks a tab's reader. Readers are injected only when asked, and only into Google pages the
 * extension may read: the manifest's Maps (and Search in development builds), or a country
 * domain the user allowed.
 */
export async function askTab<T extends ContentMessageType>(
  tab: ReadableTab,
  type: T,
  payload: ContentMessages[T]['request'],
): Promise<ContentMessages[T]['response']> {
  if (!(await browser.permissions.contains({ origins: [readerPattern(tab.url)] }))) {
    throw new Error(
      `Local SEO may not read ${new URL(tab.url).host} yet. Allow it from the side panel.`,
    )
  }
  try {
    await browser.scripting.executeScript({ target: { tabId: tab.id }, files: [SCRIPT] })
  } catch {
    throw new Error('This tab cannot be read yet. Reload it and try again.')
  }
  const reply = await withTimeout(
    browser.tabs.sendMessage(tab.id, { type, payload }) as Promise<ApiReply | undefined>,
    TIMEOUT_MS[type],
  )
  if (reply === undefined) throw new Error('This page cannot answer that request.')
  if (!reply.ok) throw new Error(reply.error)
  // The content script's handler for `type` returns this type; the channel carries it untyped.
  return reply.result as ContentMessages[T]['response']
}

// Matches the manifest's host permissions, which cover only these paths on www.google.com. A
// release holds no Search grant, so a Search page is refused here unless the user allowed it.
function readerPattern(url: string): string {
  const { origin, pathname } = new URL(url)
  return pathname.startsWith('/maps') ? `${origin}/maps/*` : `${origin}/search*`
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`The page did not answer within ${ms / 1000} s. Try again.`)),
      ms,
    )
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}
