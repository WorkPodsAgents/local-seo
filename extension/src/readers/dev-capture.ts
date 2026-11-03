// Reader tests run on pages saved from the owner's own browsing, never on pages the project
// fetches. This hands the open page to the developer to save as a fixture. Release builds leave
// it out: the page holds whatever the user is signed in as, and nothing should carry it off.
import type { ContentHandlers } from './messages'

export interface CapturedPage {
  readonly url: string
  /** ISO time of the capture, so a fixture says which version of the page it holds. */
  readonly capturedAt: string
  /** The live DOM as serialised HTML, after Google's scripts have rendered it. */
  readonly html: string
  /** Inline script bodies; Maps keeps its place data in one of them, not in the DOM. */
  readonly inlineScripts: readonly string[]
}

export function capturePage(doc: Document, url: string, now: Date): CapturedPage {
  return {
    url,
    capturedAt: now.toISOString(),
    html: `<!doctype html>\n${doc.documentElement.outerHTML}`,
    inlineScripts: Array.from(doc.querySelectorAll('script:not([src])'))
      .map((script) => script.textContent ?? '')
      .filter((text) => text.trim() !== ''),
  }
}

/** The capture handler in development builds, none in production (and none in its bundle). */
export function devHandlers(): ContentHandlers {
  if (import.meta.env.MODE === 'production') return {}
  return { 'dev:captureFixture': () => capturePage(document, location.href, new Date()) }
}
