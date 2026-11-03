// The Maps reads the tools share: a business by reference (saved as a snapshot each time), the
// results list at a point, and a place's reviews and posts read in the background tab.
import { LIMITS, type BusinessRef } from '@local-seo/core/bridge'
import type { Business, LatLng, LocalResults, Post, Review } from '@local-seo/core/business'
import { isMissing } from '@local-seo/core/business'
import { mapsSearchUrl, searchUrl } from '@local-seo/core/geo'
import type { BusinessTarget } from '@local-seo/core/providers/dataforseo-local'
// Not exported by the vendored package's entry points; deep imports keep vendor/ untouched.
// prettier-ignore
import { locationCode } from
  '../../../vendor/agent-ready/packages/core/src/providers/dataforseo/locations'
import {
  listShown,
  openBusiness,
  openPage,
  placeShown,
  placeUrlOf,
  rankedOf,
} from '../maps/resolve'
import type { MapsPage } from '../maps/page'
import { languageNote } from '../readers/maps/language'
import type { ListStop } from '../readers/paging'
import type { LocalDeps } from './deps'

/** Opens and reads a business, and keeps the read as a snapshot. */
export async function readBusiness(
  deps: LocalDeps,
  page: MapsPage,
  ref: BusinessRef,
): Promise<Business> {
  const business = await openBusiness(page, ref)
  await deps.snapshots.save(business)
  return business
}

export interface ResultsRead {
  readonly results: LocalResults
  readonly stoppedBy: ListStop
}

/**
 * The Maps results for `query`, seen from `at` when given. Maps opens a place straight away when
 * one result fits a search; that place is then the whole list.
 */
export async function readResults(
  page: MapsPage,
  query: string,
  at: LatLng | null,
  zoom: number,
  max: number,
): Promise<ResultsRead> {
  await openPage(page, at === null ? searchUrl(query) : mapsSearchUrl(query, at, zoom))
  return resultsShown(page, query, at, max)
}

/** The results the page shows now, waiting for its list to render. */
export async function resultsShown(
  page: MapsPage,
  query: string,
  at: LatLng | null,
  max: number,
): Promise<ResultsRead> {
  const shown = await listShown(page, max)
  if (shown?.kind === 'list') return shown
  const results = shown === null ? [] : [rankedOf(shown.place, 1)]
  return {
    results: { surface: 'maps', query, from: at, readAt: new Date().toISOString(), results },
    stoppedBy: shown === null ? 'no_list' : 'end',
  }
}

export interface ListRead<T> {
  readonly items: readonly T[]
  readonly stoppedBy: ListStop
}

export interface ReviewsRead extends ListRead<Review> {
  /** The Reviews tab did not open, so these are the few the Overview shows, if any. */
  readonly overviewOnly: boolean
  /** Maps' Newest sort applied; false means its default "Most relevant" order. */
  readonly newestFirst: boolean
}

/**
 * The place's reviews from its Reviews tab, sorted Newest first when Maps lets the sort be set;
 * when that tab does not open, the handful the Overview shows, which beats none but is said to
 * be only those.
 */
export async function readPlaceReviews(
  page: MapsPage,
  business: Business,
  max: number,
): Promise<ReviewsRead> {
  await openPlacePanel(page, business)
  const opened = await page.read('maps:openReviews', {})
  const newestFirst = opened && (await page.read('maps:sortReviews', {}))
  const read = await page.read('maps:readReviews', { max: clamp(max, LIMITS.reviews.max) })
  return { ...read, overviewOnly: !opened, newestFirst }
}

export async function readPlacePosts(
  page: MapsPage,
  business: Business,
  max: number,
): Promise<ListRead<Post>> {
  await openPlacePanel(page, business)
  return page.read('maps:readPosts', { max: clamp(max, LIMITS.posts.max) })
}

const POSTS_HIDDEN =
  "Google's signed-out view of Maps hides a profile's posts, so whether it posts is unknown. " +
  'Sign in to Google in this browser, or read them with source dataforseo.'

const POSTS_OVERVIEW_ONLY =
  "Maps' Overview shows only the owner's newest post, and the full Updates list is not read " +
  'in the browser, so how often the business posts is unknown. Read the posts with source ' +
  'dataforseo for the full list.'

/** Why a browser read of posts cannot tell how often the owner posts: it never reads them all. */
export function postsUnknown(read: ListRead<Post>): string {
  return read.stoppedBy === 'limited_view' && read.items.length === 0
    ? POSTS_HIDDEN
    : POSTS_OVERVIEW_ONLY
}

/** Why fields may be missing when the page Maps showed was not in English; null when it was. */
export async function pageLanguageNote(page: MapsPage): Promise<string | null> {
  return languageNote((await page.read('maps:language', {})).language)
}

/** Why a browser reviews read holds fewer reviews than the profile has, for the user. */
export function reviewNotes(read: ReviewsRead): string[] {
  const overview = overviewNote(read)
  const sample = sampleNote(read)
  return [
    ...(overview === null ? [] : [overview]),
    ...(sample === null ? [] : [sample]),
    ...(read.stoppedBy === 'limited_view' ? [LIMITED_REVIEWS] : []),
  ]
}

/**
 * Said when the reviews are in Maps' "Most relevant" order rather than newest first: a sample
 * that can skip recent reviews, so how recent the reviews and replies are is not judged from it.
 */
export function sampleNote(read: ReviewsRead): string | null {
  if (read.newestFirst || read.items.length === 0) return null
  return (
    'Maps did not sort the reviews by Newest, so these are its "Most relevant" sample, not ' +
    'the newest; review recency, reply speed and recent unanswered negatives are not judged ' +
    'from them. Signed out of Google, Maps offers no sort at all, so sign in to Google in ' +
    'this browser, or read them with source dataforseo.'
  )
}

/** Said when the reviews came from the Overview, the read's last resort; null otherwise. */
export function overviewNote(read: ReviewsRead): string | null {
  if (!read.overviewOnly) return null
  return read.items.length === 0
    ? "Maps' Reviews tab did not open, so no reviews were read."
    : "Maps' Reviews tab did not open, so these are only the few reviews its Overview shows."
}

const LIMITED_REVIEWS =
  'Signed out of Google, Maps shows only about five reviews; sign in to Google in this ' +
  'browser to read them all, or read them with source dataforseo.'

/** Opens the place's page and waits until its panel shows it, so a read never sees the last. */
async function openPlacePanel(page: MapsPage, business: Business): Promise<void> {
  await openPage(page, placeUrlOf(business))
  if ((await placeShown(page, business.ids)) === null) {
    throw new Error(`Google Maps did not show "${business.name}".`)
  }
}

/**
 * How DataForSEO is told which business: an exact id, at the business's own pin, else in its
 * country. A business in the wrong market is not found, or found in another place of the same
 * name, so with neither known the read is refused rather than run in a guessed country.
 */
export function dataForSeoTarget(business: Business): BusinessTarget {
  const { cid, placeId } = business.ids
  const id = cid !== null ? { cid } : placeId !== null ? { placeId } : { name: business.name }
  if (!isMissing(business.location)) return { id, location: business.location }
  const country = countryOf(business)
  if (country === null) {
    throw new Error(
      `Maps showed neither the pin nor the country of "${business.name}", and DataForSEO ` +
        'needs one to find it. Say which country the business is in, or open it from a Maps ' +
        'link and try again.',
    )
  }
  return { id, location: locationCode(country) }
}

/** The business's country, ISO alpha-2; null when the address did not say (Maps often omits it). */
export function countryOf(business: Business): string | null {
  return isMissing(business.address) ? null : business.address.country
}

export function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(1, Math.floor(value)))
}
