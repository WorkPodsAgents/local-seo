// What the services need from a Google Maps page they open themselves: load an address and ask
// the readers. The service worker's scratch tab implements it; tests use a fake, so resolution,
// grids and audits are tested without Chrome or Google.
import type { ContentMessageType, ContentMessages } from '../readers/messages'

/** The page that loaded: the address it ended on, and why Google refused, when it did. */
export interface PageLoad {
  readonly url: string
  /** Google's "unusual traffic" or consent page; null when the address loaded. */
  readonly blocked: string | null
}

export interface MapsPage {
  open(url: string): Promise<PageLoad>
  /** The address the tab shows now; Maps adds the map view to it after it loads. */
  currentUrl(): Promise<string>
  read<T extends ContentMessageType>(
    type: T,
    payload: ContentMessages[T]['request'],
  ): Promise<ContentMessages[T]['response']>
  wait(ms: number): Promise<void>
}

/** Google refused the page; nothing more is read from it until the user deals with it. */
export class GoogleBlocked extends Error {
  constructor(readonly reason: string) {
    super(reason)
  }
}

const SORRY =
  'Google showed its "unusual traffic" page, so reading stopped. Open Google Maps in a tab, ' +
  'answer it there, and try again later.'
const CONSENT =
  'Google asked for cookie consent first. Open Google Maps in a tab, answer it, and try again.'

/** Why `url` is a page Google shows instead of Maps; null for any other page. */
export function blockedReason(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (/^\/sorry(\/|$)/.test(parsed.pathname)) return SORRY
  if (/^consent\.google\./.test(parsed.hostname)) return CONSENT
  return null
}
