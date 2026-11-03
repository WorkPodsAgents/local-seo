// From what a tool was given (a link, an id, a name and town, a place name) to an open Maps page
// and the Business on it. Ids open the place directly; a name is searched and the result whose
// name matches is opened by its CID, so the record read always comes from the place's own page.
// Maps draws its panel and list a while after the page says it loaded, and a read made before
// then sees the last page or nothing, so every read here waits for what was asked for to show.
import type { BusinessRef, Near } from '@local-seo/core/bridge'
import type {
  Business,
  BusinessIds,
  Known,
  LatLng,
  LocalResults,
  RankedBusiness,
} from '@local-seo/core/business'
import { isMissing } from '@local-seo/core/business'
import { businessRefUrl, cidUrl, parseMapsUrl, sameIds, searchUrl } from '@local-seo/core/geo'
import { lacksPlaceData } from '../readers/maps/read-place'
import type { ListStop } from '../readers/paging'
import { GoogleBlocked, type MapsPage, type PageLoad } from './page'

/** Long enough for a slow Maps panel to render; past it the page is not going to show it. */
const SHOW_WAIT_MS = 15_000
const POLL_MS = 500
const RETRY_MS = 1_000

export async function openPage(page: MapsPage, url: string): Promise<PageLoad> {
  const load = await page.open(url)
  if (load.blocked !== null) throw new GoogleBlocked(load.blocked)
  return load
}

/**
 * Opens a place page and reads the place once the panel shows the one asked for; null when it
 * never does. A place read without Maps' place data is loaded once more at its own address.
 */
export async function openPlace(
  page: MapsPage,
  url: string,
  wanted: BusinessIds | null,
): Promise<Business | null> {
  await openPage(page, url)
  const place = await placeShown(page, wanted)
  if (place === null || !lacksPlaceData(place)) return place
  const here = await page.currentUrl()
  if (!/\/maps\/place\//.test(here)) return place
  await openPage(page, here)
  return (await placeShown(page, wanted)) ?? place
}

/** The place the panel shows once its ids fit `wanted`; null when none shows in time. */
export async function placeShown(
  page: MapsPage,
  wanted: BusinessIds | null,
): Promise<Business | null> {
  for (let waited = 0; ; waited += POLL_MS) {
    const place = await page.read('maps:readPlace', {})
    if (place !== null && fits(place.ids, wanted)) return place
    if (waited >= SHOW_WAIT_MS) return null
    await page.wait(POLL_MS)
  }
}

/**
 * Whether a panel's ids can be the place asked for: one id in common, or none to compare (a
 * place id asked for before the panel exposes one). Differing ids mean the last page still shows.
 */
function fits(shown: BusinessIds, wanted: BusinessIds | null): boolean {
  if (wanted === null || sameIds(shown, wanted)) return true
  const pairs: [string | null, string | null][] = [
    [shown.placeId, wanted.placeId],
    [shown.cid, wanted.cid],
    [shown.featureId, wanted.featureId],
    [shown.kgId, wanted.kgId],
  ]
  return pairs.every(([a, b]) => a === null || b === null)
}

export type ListShown =
  | { readonly kind: 'list'; readonly results: LocalResults; readonly stoppedBy: ListStop }
  /** Maps opened the one place that fits the search instead of a list. */
  | { readonly kind: 'place'; readonly place: Business }

/**
 * The results list of the search the page shows, once its feed has rendered, or the place Maps
 * opened instead; a list that never rendered comes back empty with `no_list`, and null when the
 * address carries no search.
 */
export async function listShown(page: MapsPage, max: number): Promise<ListShown | null> {
  for (let waited = 0; ; waited += POLL_MS) {
    const list = await page.read('maps:readResults', { max })
    if (list !== null && (list.stoppedBy !== 'no_list' || list.results.results.length > 0)) {
      return { kind: 'list', ...list }
    }
    const place = await page.read('maps:readPlace', {})
    if (place !== null) return { kind: 'place', place }
    if (waited >= SHOW_WAIT_MS) return list === null ? null : { kind: 'list', ...list }
    await page.wait(POLL_MS)
  }
}

export async function openBusiness(page: MapsPage, ref: BusinessRef): Promise<Business> {
  const target = businessRefUrl(ref)
  if (target.kind === 'place') {
    const place = await openPlace(page, target.url, wantedOf(ref))
    if (place === null) {
      throw new Error('Google Maps showed no place at that address. Check the link or id.')
    }
    return place
  }
  await openPage(page, target.url)
  const shown = await listShown(page, 20)
  if (shown?.kind === 'place') return shown.place
  const pick = shown === null ? undefined : pickByName(shown.results.results, target.name)
  if (pick === undefined) {
    throw new Error(`Google Maps found no place named "${target.name}" there.`)
  }
  const opened = await openPlace(page, placeUrlOf(pick), pick.ids)
  if (opened === null) throw new Error(`Google Maps did not open "${pick.name}".`)
  return opened
}

/** The ids a reference names, which the panel must show before it is read as that place. */
function wantedOf(ref: BusinessRef): BusinessIds | null {
  const none = { placeId: null, cid: null, kgId: null, featureId: null }
  if ('cid' in ref) return { ...none, cid: ref.cid }
  if ('placeId' in ref) return { ...none, placeId: ref.placeId }
  if ('mapsUrl' in ref) return parseMapsUrl(ref.mapsUrl)?.ids ?? null
  return null
}

/**
 * The ids Maps gives the business a name and town find, read from the results list without
 * opening the place; Maps opens the place itself when one result fits, and it is read then.
 */
export async function idsByName(
  page: MapsPage,
  ref: { readonly name: string; readonly city: string },
): Promise<BusinessIds> {
  await openPage(page, businessRefUrl(ref).url)
  const shown = await listShown(page, 20)
  const found =
    shown?.kind === 'place'
      ? shown.place.ids
      : shown === null
        ? undefined
        : pickByName(shown.results.results, ref.name)?.ids
  if (found === undefined) throw new Error(`Google Maps found no place named "${ref.name}" there.`)
  return found
}

/** The address of a ranked result's own place page, by its CID or place id. */
export function placeUrlOf(result: Pick<RankedBusiness, 'ids' | 'name'>): string {
  if (result.ids.cid !== null) return cidUrl(result.ids.cid)
  if (result.ids.placeId !== null) return businessRefUrl({ placeId: result.ids.placeId }).url
  throw new Error(`Maps gave no id for "${result.name}" to open it by.`)
}

/** A business as one entry of a ranked list. */
export function rankedOf(business: Business, position: number): RankedBusiness {
  const known = <T>(value: Known<T>): T | null => (isMissing(value) ? null : value)
  return {
    position,
    sponsored: false,
    name: business.name,
    ids: business.ids,
    primaryCategory: known(business.categories.primary),
    rating: known(business.rating),
    reviewCount: known(business.reviewCount),
    address: known(business.address)?.formatted ?? null,
    location: known(business.location),
  }
}

/** The organic result whose name matches best: exact, then containing, then none. */
export function pickByName(
  results: readonly RankedBusiness[],
  name: string,
): RankedBusiness | undefined {
  const wanted = plain(name)
  const organic = results.filter((result) => !result.sponsored)
  return (
    organic.find((result) => plain(result.name) === wanted) ??
    organic.find((result) => plain(result.name).includes(wanted))
  )
}

const VIEW_TRIES = 5

/** A point, as given or as the map centre Maps settles on for a place name. */
export async function resolveNear(page: MapsPage, near: Near): Promise<LatLng> {
  if (typeof near !== 'string') return near
  let url = (await openPage(page, searchUrl(near))).url
  for (let attempt = 1; attempt <= VIEW_TRIES; attempt += 1) {
    const center = parseMapsUrl(url)?.center ?? null
    if (center !== null) return center
    await page.wait(RETRY_MS)
    url = await page.currentUrl()
  }
  throw new Error(`Google Maps did not find the place "${near}".`)
}

function plain(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}
