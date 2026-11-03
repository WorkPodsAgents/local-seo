import { devHandlers } from '../src/readers/dev-capture'
import { featureIdFromUrl } from '../src/readers/google-urls'
import { readMapsPlace } from '../src/readers/maps/read-place'
import { mapsLanguage } from '../src/readers/maps/language'
import { isLimitedView } from '../src/readers/maps/page'
import { placeBodyFor } from '../src/readers/maps/place-hook'
import { readPlacePostsList } from '../src/readers/maps/read-posts'
import { mapsResultCards, mapsResultsFeed, readMapsResults } from '../src/readers/maps/read-results'
import {
  expandReviews,
  openReviewsTab,
  readReviews,
  reviewsFeed,
  sortReviewsNewest,
} from '../src/readers/maps/read-reviews'
import { serveContentMessages } from '../src/readers/messages'
import { hideCategoryLabels, showCategoryLabels } from '../src/readers/overlay/category-labels'
import {
  boundedWant,
  realSleep,
  scrollFeed,
  type Feed,
  type ListStop,
  type ScrollLimits,
} from '../src/readers/paging'

const INSTALLED = Symbol.for('local-seo.maps')

// Maps stops at about 120 results; reviews and posts are capped so one read stays under the tab
// client's timeout (step cap x settle time) and the page stays responsive.
const MAX_RESULTS = 120
const MAX_REVIEWS = 500
const MAX_POSTS = 100
const SCROLL: Omit<ScrollLimits, 'want'> = { patience: 3, maxSteps: 40, settleMs: 800 }

/** A list that stopped growing in Maps' limited view ended because of the view, not the place. */
function stopReason(stopped: ListStop): ListStop {
  return stopped === 'end' && isLimitedView(document) ? 'limited_view' : stopped
}

// Reads the Google Maps tab, injected when the panel or an agent asks for it; the guard keeps a
// second injection from answering every message twice.
export default defineContentScript({
  registration: 'runtime',
  main() {
    const scope = globalThis as { [INSTALLED]?: true }
    if (scope[INSTALLED]) return
    scope[INSTALLED] = true
    serveContentMessages({
      'maps:readPlace': async () => {
        const featureId = featureIdFromUrl(location.href)
        const body = featureId === null ? null : await placeBodyFor(window, featureId)
        return readMapsPlace(document, location.href, new Date(), body)
      },
      'maps:readResults': async ({ max }) => {
        const limits = { ...SCROLL, want: boundedWant(max, MAX_RESULTS) }
        const feed = mapsResultsFeed(document)
        const stoppedBy =
          feed === null ? 'no_list' : stopReason(await scrollFeed(feed, limits, realSleep))
        const read = readMapsResults(document, location.href, new Date())
        if (read === null) return null
        // Ads keep their own numbering, so the cut is by organic position, not by card count.
        const results = {
          ...read,
          results: read.results.filter((r) => r.sponsored || r.position <= limits.want),
        }
        return { results, stoppedBy }
      },
      'maps:openReviews': () => openReviewsTab(document, realSleep),
      'maps:sortReviews': () => sortReviewsNewest(document, realSleep),
      'maps:readReviews': async ({ max }) => {
        const want = boundedWant(max, MAX_REVIEWS)
        const feed = await settledReviewsFeed()
        if (feed === null) return { items: [], stoppedBy: 'no_list' }
        const stopped = await scrollFeed(feed, { ...SCROLL, want }, realSleep)
        // Opening the reviews cut short with "More" re-renders them; let the page settle first.
        if (expandReviews(feed.container) > 0) await realSleep(SCROLL.settleMs)
        return { items: readReviews(feed.container).slice(0, want), stoppedBy: stopReason(stopped) }
      },
      'maps:readPosts': ({ max }) =>
        readPlacePostsList(document, { ...SCROLL, want: boundedWant(max, MAX_POSTS) }, realSleep),
      'maps:language': () => ({ language: mapsLanguage(document, location.href) }),
      'overlay:show': () => ({ labelled: showCategoryLabels(mapsResultCards(document)) }),
      'overlay:hide': () => ({ removed: hideCategoryLabels(document) }),
      ...devHandlers(),
    })
  },
})

/**
 * The Reviews tab renders a moment after it is selected, while the Overview's few reviews are
 * still in the page; reading at once can find the old list or none. Wait until the list holds
 * reviews the reader understands, a bounded number of times.
 */
async function settledReviewsFeed(): Promise<Feed | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const feed = reviewsFeed(document)
    if (feed !== null && readReviews(feed.container).length > 0) return feed
    await realSleep(SCROLL.settleMs)
  }
  return reviewsFeed(document)
}
