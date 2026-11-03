// Local SEO's DataForSEO operations bound to one set of dependencies: reviews, posts and a Maps
// search from a point.
import type { Clock } from '@open-agent-ready/core/providers'
import type { Paid } from '@open-agent-ready/core/providers'
import type { LatLng, LocalResults, Post, RankedBusiness, Review } from '../../business'
import { array, object } from '../../../../../vendor/agent-ready/packages/core/src/providers/json'
import { isoTimestamp, postOf, rankedOf, reviewOf } from './map'
import type { Priority } from './prices'
import { mapsLivePrice, reviewsPrice, updatesPrice } from './prices'
import type { QueuedDeps } from './tasks'
import { liveTask, queuedTask } from './tasks'

export interface LocalDataForSeoDeps extends QueuedDeps {
  /** Stamps `readAt` when a response carries no datetime. */
  readonly clock: Clock
}

/** Which business: an exact id, or a name searched in `location`. */
export interface BusinessTarget {
  readonly id: { readonly cid: string } | { readonly placeId: string } | { readonly name: string }
  /**
   * A DataForSEO location name ("London,England,United Kingdom"), a location code (2826), or
   * the business's own pin. Reviews and updates each accept a coordinate.
   */
  readonly location: string | number | LatLng
  /** Defaults to "en". */
  readonly languageCode?: string
}

export interface ReviewsOptions {
  /** Reviews to fetch, billed per 10; defaults to 50, DataForSEO allows up to 4490. */
  readonly depth?: number
  readonly sortBy?: 'newest' | 'highest_rating' | 'lowest_rating' | 'relevant'
  /** Defaults to high: a standard task can queue for up to 45 minutes. */
  readonly priority?: Priority
}

export interface PostsOptions {
  readonly depth?: number
  readonly priority?: Priority
}

export interface MapsOptions {
  /** Results to read, billed per 100; defaults to 20, DataForSEO allows up to 700. */
  readonly depth?: number
  readonly languageCode?: string
}

export interface LocalDataForSeo {
  reviews(target: BusinessTarget, options?: ReviewsOptions): Promise<Paid<readonly Review[]>>
  posts(target: BusinessTarget, options?: PostsOptions): Promise<Paid<readonly Post[]>>
  /** The Maps results for `query` as seen from `at` at `zoom` (3 to 21). */
  mapsAt(
    query: string,
    at: LatLng,
    zoom: number,
    options?: MapsOptions,
  ): Promise<Paid<LocalResults>>
}

const BASE = '/v3/business_data/google'

export function createLocalDataForSeo(deps: LocalDataForSeoDeps): LocalDataForSeo {
  const readAt = (result: unknown) =>
    isoTimestamp(object(result)?.['datetime']) ?? new Date(deps.clock()).toISOString()
  return {
    async reviews(target, options = {}) {
      const depth = options.depth ?? 50
      const priority = options.priority ?? 'high'
      const body = {
        ...reviewTargetOf(target),
        ...placeOf(target),
        depth,
        sort_by: options.sortBy ?? 'newest',
        priority: priority === 'high' ? 2 : 1,
      }
      const paid = await queuedTask(deps, `${BASE}/reviews`, body, reviewsPrice(depth, priority))
      const reviews = itemsOf(paid.data)
        .map(reviewOf)
        .filter((review): review is Review => review !== null)
      return { ...paid, data: reviews }
    },
    async posts(target, options = {}) {
      const depth = options.depth ?? 20
      const priority = options.priority ?? 'high'
      const body = {
        keyword: keywordOf(target),
        ...placeOf(target),
        depth,
        priority: priority === 'high' ? 2 : 1,
      }
      const estimate = updatesPrice(depth, priority)
      const paid = await queuedTask(deps, `${BASE}/my_business_updates`, body, estimate)
      return { ...paid, data: itemsOf(paid.data).map(postOf) }
    },
    async mapsAt(query, at, zoom, options = {}) {
      const depth = options.depth ?? 20
      const body = {
        keyword: query,
        location_coordinate: `${round7(at.lat)},${round7(at.lng)},${zoom}z`,
        language_code: options.languageCode ?? 'en',
        depth,
      }
      const paid = await liveTask(
        deps,
        '/v3/serp/google/maps/live/advanced',
        body,
        mapsLivePrice(depth),
      )
      const result = paid.data[0]
      const results = itemsOf(paid.data)
        .map(rankedOf)
        .filter((entry): entry is RankedBusiness => entry !== null)
      return {
        ...paid,
        data: { surface: 'maps', query, from: at, readAt: readAt(result), results },
      }
    },
  }
}

function keywordOf(target: BusinessTarget): string {
  const id = target.id
  if ('cid' in id) return `cid:${id.cid}`
  if ('placeId' in id) return `place_id:${id.placeId}`
  return id.name
}

/** The reviews endpoint takes cid and place_id as fields of their own. */
function reviewTargetOf(target: BusinessTarget): Record<string, string> {
  const id = target.id
  if ('cid' in id) return { cid: id.cid }
  if ('placeId' in id) return { place_id: id.placeId }
  return { keyword: id.name }
}

/**
 * A pin is sent with DataForSEO's smallest radius, 200 m, so the search stays on the place
 * itself; "latitude,longitude,radius" with at most 7 decimals, as both endpoints document.
 */
const PIN_RADIUS_M = 200

function placeOf(target: BusinessTarget): Record<string, string | number> {
  const at = target.location
  return {
    ...(typeof at === 'number'
      ? { location_code: at }
      : typeof at === 'string'
        ? { location_name: at }
        : { location_coordinate: `${round7(at.lat)},${round7(at.lng)},${PIN_RADIUS_M}` }),
    language_code: target.languageCode ?? 'en',
  }
}

function itemsOf(results: readonly unknown[]): JsonObjectList {
  return array(object(results[0])?.['items']).flatMap((item) => {
    const found = object(item)
    return found === null ? [] : [found]
  })
}

type JsonObjectList = Readonly<Record<string, unknown>>[]

function round7(value: number): number {
  return Math.round(value * 1e7) / 1e7
}
