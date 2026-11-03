// Reads the reviews the place panel has loaded. The content script scrolls the list and opens
// truncated texts first; this reads what is in it. Every review carries `data-review-id` on its
// parts, which is the hook; ages stay as Maps wrote them ("3 months ago"), resolved later.
import type { Review } from '@local-seo/core/business'
import type { Feed, Sleep } from '../paging'
import { countIn, panelScroller, placePanel, squash, visibleText } from './page'

// The tab's English label starts "Reviews for <place>"; elsewhere the label is translated, and
// Reviews is the tab after Overview on every place panel saved so far.
const REVIEWS_TAB = '[role="tab"][aria-label^="Reviews"]'
const SECOND_TAB = '[role="tab"][data-tab-index="1"]'
const TAB_POLL_MS = 250
/** Maps answers a tab click within a second or two; longer means the tab holds no reviews. */
const TAB_WAIT_MS = 8_000

/**
 * Opens the place panel's Reviews tab and waits until it shows reviews; false when the panel
 * has no such tab or it showed none in time. The Overview also holds a few reviews, so the wait
 * is for the tab to be selected as well, not only for a review to exist.
 */
export async function openReviewsTab(doc: Document, sleep: Sleep): Promise<boolean> {
  // Maps re-renders the panel when a tab is chosen, so the tab and panel are looked up afresh on
  // every poll; holding the first ones would watch elements that have left the page.
  const reviewsTab = () => {
    const panel = placePanel(doc)
    const tab = panel?.querySelector(REVIEWS_TAB) ?? panel?.querySelector(SECOND_TAB) ?? null
    return panel === null || tab === null ? null : { panel, tab }
  }
  const first = reviewsTab()
  if (first === null) return false
  const open = () => {
    const now = reviewsTab()
    return (
      now !== null &&
      now.tab.getAttribute('aria-selected') === 'true' &&
      now.panel.querySelector('[data-review-id]') !== null
    )
  }
  if (first.tab.getAttribute('aria-selected') !== 'true') (first.tab as HTMLElement).click()
  for (let waited = 0; waited < TAB_WAIT_MS; waited += TAB_POLL_MS) {
    if (open()) return true
    await sleep(TAB_POLL_MS)
  }
  return open()
}

// The sort control: its English label, else Maps' own value, which is not translated.
const SORT_BUTTON = ['button[aria-label="Sort reviews"]', 'button[data-value="Sort"]']
// Maps' sort menu lists Most relevant, Newest, Highest rating, Lowest rating, in that order in
// every language seen; the label is tried first, the position is the fallback.
const NEWEST = /^newest$/i
const NEWEST_INDEX = 1
const MENU_WAIT_MS = 3_000
const RESORT_WAIT_MS = 6_000

/**
 * Sorts the open Reviews tab by Newest and waits for the list to re-render; false when there was
 * no sort control, no menu opened, or the list did not change, so the caller can say the reviews
 * are Maps' default "Most relevant" sample rather than the newest. No saved page holds the open
 * menu yet, so every step checks before it acts.
 */
export async function sortReviewsNewest(doc: Document, sleep: Sleep): Promise<boolean> {
  const panel = placePanel(doc)
  const button = SORT_BUTTON.map((selector) => panel?.querySelector(selector) ?? null).find(
    (found) => found !== null,
  )
  if (button === undefined) return false
  const before = panel === null ? undefined : reviewElements(panel)[0]
  ;(button as HTMLElement).click()
  const items = await waitFor(sleep, MENU_WAIT_MS, () => {
    const found = Array.from(doc.querySelectorAll('[role="menuitemradio"]'))
    return found.length > NEWEST_INDEX ? found : null
  })
  if (items === null) {
    // Signed out, Maps answers the sort control with a sign-in wall instead of the menu; it is
    // closed so it does not sit over the panel for the reads that follow.
    dismissSignInWall(doc)
    return false
  }
  const newest = items.find((item) => NEWEST.test(squash(visibleText(item)))) ?? items[NEWEST_INDEX]
  if (newest === undefined) return false
  if (newest.getAttribute('aria-checked') === 'true') {
    // Already newest first; the click closes the menu without a reload.
    ;(newest as HTMLElement).click()
    return true
  }
  ;(newest as HTMLElement).click()
  // Maps replaces the review elements when the order changes; the old first one leaves the page.
  const resorted = await waitFor(sleep, RESORT_WAIT_MS, () => {
    const first = reviewElements(placePanel(doc) ?? doc)[0]
    return first !== undefined && (before === undefined || !before.isConnected) ? first : null
  })
  return resorted !== null
}

/** Closes Maps' "Sign in to get the best of Google Maps" dialog; false when none is open. */
export function dismissSignInWall(doc: Document): boolean {
  // Maps keeps other dialogs in the page; the wall is the one with Maps' own sign-in action,
  // and `pane.<id>.dismiss` closes it. Action names are not translated.
  const wall = Array.from(doc.querySelectorAll('[role="dialog"]')).find(
    (dialog) => dialog.querySelector('button[jsaction$=".signIn"]') !== null,
  )
  const dismiss = wall?.querySelector('button[jsaction$=".dismiss"]') ?? null
  if (dismiss === null) return false
  ;(dismiss as HTMLElement).click()
  return true
}

async function waitFor<T>(sleep: Sleep, maxMs: number, found: () => T | null): Promise<T | null> {
  for (let waited = 0; waited < maxMs; waited += TAB_POLL_MS) {
    const value = found()
    if (value !== null) return value
    await sleep(TAB_POLL_MS)
  }
  return found()
}

/** The reviews under `root`, once each, in page order. */
export function readReviews(root: ParentNode): readonly Review[] {
  const reviews: Review[] = []
  for (const element of reviewElements(root)) {
    const review = readReview(element)
    if (review !== null) reviews.push(review)
  }
  return reviews
}

/** The scrollable list holding the place's reviews; null when the panel shows none. */
export function reviewsFeed(doc: Document): Feed | null {
  const panel = placePanel(doc)
  const first = panel === null ? undefined : reviewElements(panel)[0]
  if (panel === null || first === undefined) return null
  const container = panelScroller(panel, first)
  if (container === null) return null
  return { container, count: () => reviewElements(container).length }
}

/**
 * Opens every review cut short with "More", so the read gets the whole text; returns how many it
 * opened. The button is the one review control that toggles an expansion.
 */
export function expandReviews(root: ParentNode): number {
  const buttons = Array.from(root.querySelectorAll('button[data-review-id][aria-expanded="false"]'))
  for (const button of buttons) (button as HTMLElement).click()
  return buttons.length
}

/** The outermost element of each review; its inner parts repeat the same id. */
function reviewElements(root: ParentNode): Element[] {
  const seen = new Set<string>()
  const outer: Element[] = []
  for (const element of Array.from(root.querySelectorAll('[data-review-id]'))) {
    const id = element.getAttribute('data-review-id') ?? ''
    if (id === '' || seen.has(id)) continue
    seen.add(id)
    outer.push(element)
  }
  return outer
}

function readReview(element: Element): Review | null {
  const stars = starsImage(element)
  // A review without a star rating is not one this reader understands; it is left out, not zeroed.
  if (stars === null) return null
  const age = stars.image.nextElementSibling
  // The review text has an id (the "More" button points at it); the owner's reply does not.
  const text = element.querySelector('[lang][id]')
  const reply = element.querySelector('[lang]:not([id])')
  const author = Array.from(element.querySelectorAll('[jsaction*="reviewerLink"]'))
    .map((part) => squash(visibleText(part)))
    .join(' ')
  const authorReviews = /([\d,.]+)\s+reviews?\b/i.exec(author)?.[1]
  const photos = new Set(
    Array.from(element.querySelectorAll('[data-photo-index]')).map((photo) =>
      photo.getAttribute('data-photo-index'),
    ),
  )
  return {
    id: element.getAttribute('data-review-id'),
    rating: stars.rating,
    text: text === null ? null : textWithoutControls(text),
    publishedAt: null,
    relativeAge: age === null ? null : squash(visibleText(age)) || null,
    ownerReply: replyOf(reply),
    authorReviewCount: authorReviews === undefined ? null : countIn(authorReviews),
    photoCount: photos.size,
  }
}

/** "5 stars" (or "4/5" on some places) on the review's labelled star image. */
function starsImage(element: Element): { image: Element; rating: number } | null {
  for (const image of Array.from(element.querySelectorAll('[role="img"][aria-label]'))) {
    const match = /^\s*([1-5])(?:[.,]0)?(?:\/5)?\b/.exec(image.getAttribute('aria-label') ?? '')
    if (match?.[1] !== undefined) return { image, rating: Number(match[1]) }
  }
  return null
}

/** The owner's reply text. Maps shows only its relative age, which the model has no place for. */
function replyOf(reply: Element | null): Review['ownerReply'] {
  if (reply === null) return null
  const text = textWithoutControls(reply)
  return text === null ? null : { text, publishedAt: null }
}

/** The text a person reads, without the "More" and translation buttons inside it. */
function textWithoutControls(element: Element): string | null {
  const parts: string[] = []
  const walk = (node: Node): void => {
    if (node.nodeType === 1 && (node as Element).tagName === 'BUTTON') return
    if (node.nodeType === 3) parts.push(visibleText(node))
    else if (node.nodeType === 1) {
      if ((node as Element).getAttribute('aria-hidden') === 'true') return
      node.childNodes.forEach(walk)
    }
  }
  walk(element)
  const text = parts
    .join('')
    .replace(/[ \t  ]+/g, ' ')
    .trim()
  return text === '' ? null : text
}
