// Reads the Maps results list (name, category, rating, position and pin of each business) and
// finds its cards for the category overlay. Each card is an `article` in the list's `feed`, its
// link carries the place's ids and pin, and its rating sits in a labelled image; class names are
// not used.
import type { LocalResults, RankedBusiness } from '@local-seo/core/business'
import { idsFromUrl, mapViewFromUrl, placePointFromUrl, queryFromUrl } from '../google-urls'
import type { ResultCard } from '../overlay/category-labels'
import type { Feed } from '../paging'
import { countIn, ratingIn, squash, visibleText } from './page'

/** The results for the query in the address, or null when the address carries no query. */
export function readMapsResults(doc: Document, url: string, now: Date): LocalResults | null {
  const query = queryFromUrl(url)
  if (query === null) return null
  const view = mapViewFromUrl(url)
  return {
    surface: 'maps',
    query,
    from: view === null ? null : { lat: view.lat, lng: view.lng },
    readAt: now.toISOString(),
    results: rankCards(resultCards(doc)),
  }
}

/** The scrollable results list and how many result cards it holds; null when none is shown. */
export function mapsResultsFeed(doc: Document): Feed | null {
  const feed = doc.querySelector('[role="feed"]')
  if (feed === null) return null
  // Ads sit among the results without taking a rank, so a depth of 20 means 20 organic cards.
  return {
    container: feed,
    count: () =>
      Array.from(feed.querySelectorAll('[role="article"]')).filter((card) => !isSponsored(card))
        .length,
  }
}

/** Each result card with its primary category, for the overlay. */
export function mapsResultCards(doc: Document): readonly ResultCard[] {
  return resultCards(doc).map((card) => ({ element: card, category: cardLines(card).category }))
}

function resultCards(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('[role="feed"] [role="article"]'))
}

/** Organic cards count 1, 2, 3…; ads keep their own count, as DataForSEO numbers paid items. */
function rankCards(cards: readonly Element[]): RankedBusiness[] {
  let organic = 0
  let paid = 0
  const ranked: RankedBusiness[] = []
  for (const card of cards) {
    const link = card.querySelector('a[href*="/maps/place/"]')
    const name = squash(link?.getAttribute('aria-label') ?? '')
    if (link === null || name === '') continue
    const sponsored = isSponsored(card)
    const position = sponsored ? (paid += 1) : (organic += 1)
    const stars = starsOf(card)
    const lines = cardLines(card)
    const href = link.getAttribute('href') ?? ''
    ranked.push({
      position,
      sponsored,
      name,
      ids: idsFromUrl(href),
      primaryCategory: lines.category,
      rating: stars.rating,
      reviewCount: stars.reviewCount,
      address: lines.address,
      location: placePointFromUrl(href),
    })
  }
  return ranked
}

/** An ad links through Google's ad click path; "Sponsored" is only its English label. */
function isSponsored(card: Element): boolean {
  return (
    card.querySelector('a[href*="/aclk"]') !== null ||
    card.querySelector('[aria-label="Sponsored"]') !== null
  )
}

/** "4.7 stars 1,734 Reviews": the rating opens the label and the count is the number after it. */
function starsOf(within: Element): { rating: number | null; reviewCount: number | null } {
  for (const image of Array.from(within.querySelectorAll('[role="img"][aria-label]'))) {
    const label = image.getAttribute('aria-label') ?? ''
    const rating = ratingIn(label)
    if (rating === null) continue
    const rest = label.replace(/^\s*\d[.,]\d/, '')
    return { rating, reviewCount: countIn(rest) }
  }
  return { rating: null, reviewCount: null }
}

/**
 * A card's text lines are rows of spans split by "·": the first is "Category · Address" (just the
 * category for a service-area business, whose street is hidden), the next the hours and phone.
 * A row is the outermost element whose children are all spans; the ad and buttons are skipped.
 */
function cardLines(card: Element): { category: string | null; address: string | null } {
  const rows = Array.from(card.querySelectorAll('div, span')).filter(
    (row) =>
      row.children.length > 0 &&
      Array.from(row.children).every((child) => child.tagName === 'SPAN') &&
      row.closest('a, button, [role="img"]') === null &&
      !isInsideRow(row, card),
  )
  for (const row of rows) {
    // The rating row can carry a price level ("· $$") that is not a category.
    if (starsOf(row).rating !== null) continue
    const segments = Array.from(row.children)
      .map((child) => squash(visibleText(child)).replace(/^·\s*/, ''))
      .filter((segment) => segment !== '' && segment !== '·')
    if (segments.length === 0) continue
    const [category = null] = segments
    return { category, address: segments.length > 1 ? (segments.at(-1) ?? null) : null }
  }
  return { category: null, address: null }
}

function isInsideRow(row: Element, card: Element): boolean {
  for (let node = row.parentElement; node !== null && node !== card; node = node.parentElement) {
    if (node.children.length > 0 && Array.from(node.children).every((c) => c.tagName === 'SPAN')) {
      return true
    }
  }
  return false
}
