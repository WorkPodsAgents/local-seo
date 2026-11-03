// Reads the place data Maps fetches for a place panel (`/maps/preview/place`). Maps draws only
// part of it: the secondary categories, and in the signed-out limited view the owner's
// description and the owner's name, are in this response and nowhere on the page. The response
// is positional arrays with no names, so each field is checked for its shape where it is read,
// and a field whose shape moved is missing with a reason instead of a wrong value.
import {
  absent,
  missing,
  type Address,
  type AttributeGroup,
  type BusinessIds,
  type Hours,
  type Known,
  type LatLng,
  type OpenInterval,
  type Weekday,
} from '@local-seo/core/business'
import { cidFromFeatureId } from '../google-urls'

/** The fields of a Business this response holds. `categories` lists the primary first. */
export interface PlaceData {
  readonly ids: BusinessIds
  readonly name: string
  readonly categories: Known<readonly string[]>
  readonly description: Known<string>
  readonly claimed: Known<boolean>
  readonly phone: Known<string>
  readonly website: Known<string>
  readonly address: Known<Address>
  readonly location: Known<LatLng>
  readonly hours: Known<Hours>
  readonly attributes: Known<readonly AttributeGroup[]>
  readonly rating: Known<number>
  readonly reviewCount: Known<number>
}

const FEATURE_ID = /^0x[0-9a-f]{1,16}:0x[0-9a-f]{1,16}$/i
const PLACE_ID = /^ChIJ[\w-]+$/
const KG_ID = /^\/[gm]\/[\w-]+$/
// Maps numbers the days of its hours table from Monday, whatever language it writes them in.
const WEEK: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_CLOSED = 2
const UNREADABLE = 'Maps sent this in a form Local SEO cannot read'

/**
 * The place in a `/maps/preview/place` body, or null when the body is not place data for
 * `featureId`: a response for another place must never fill this one's fields.
 */
export function parsePlaceData(body: string, featureId: string): PlaceData | null {
  const place = at(json(body), 6)
  const ownId = text(at(place, 10))
  const name = text(at(place, 11))
  if (ownId === null || name === null || ownId.toLowerCase() !== featureId.toLowerCase()) {
    return null
  }
  return {
    ids: ids(place, ownId.toLowerCase()),
    name,
    categories: categories(at(place, 13)),
    description: description(at(place, 154)),
    claimed: claimed(at(place, 57)),
    phone: known(text(at(place, 178, 0, 0)), 'Maps sent no phone number'),
    website: known(text(at(place, 7, 0)), 'Maps sent no website'),
    address: address(place),
    location: location(at(place, 9)),
    hours: hours(at(place, 203, 0)),
    attributes: attributes(at(place, 100, 1)),
    rating: rating(at(place, 4, 7)),
    reviewCount: reviewCount(at(place, 4, 8)),
  }
}

/** Maps prefixes its JSON with `)]}'` so the response cannot run as a script. */
function json(body: string): unknown {
  try {
    return JSON.parse(body.replace(/^\)\]\}'\s*/, '')) as unknown
  } catch {
    return null
  }
}

/** The value at a path of array indices, or undefined where the path leaves the arrays. */
function at(value: unknown, ...path: number[]): unknown {
  let node = value
  for (const index of path) {
    if (!Array.isArray(node)) return undefined
    node = node[index]
  }
  return node
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function matching(value: unknown, pattern: RegExp): string | null {
  const shown = text(value)
  return shown !== null && pattern.test(shown) ? shown : null
}

function known<T>(value: T | null, reason: string): Known<T> {
  return value === null ? missing(reason) : value
}

/**
 * The place's own ids sit at 78 (place id) and 89 (KG id), and again in the id list at 227. The
 * CID comes from the feature id: the long decimal number in that list is a different id.
 */
function ids(place: unknown, featureId: string): BusinessIds {
  const list = at(place, 227, 0)
  return {
    placeId: matching(at(place, 78), PLACE_ID) ?? matching(at(list, 4), PLACE_ID),
    cid: cidFromFeatureId(featureId),
    kgId: matching(at(place, 89), KG_ID) ?? matching(at(list, 3), KG_ID),
    featureId: FEATURE_ID.test(featureId) ? featureId : null,
  }
}

function categories(value: unknown): Known<readonly string[]> {
  if (!Array.isArray(value)) return missing(`Maps sent no categories: ${UNREADABLE}`)
  const names = value.map(text)
  if (names.length === 0 || names.some((name) => name === null)) {
    return missing(`the categories: ${UNREADABLE}`)
  }
  return names as string[]
}

/** Null at 154 is a place whose owner wrote no description; Maps sends it to signed-out users. */
function description(value: unknown): Known<string> {
  if (value === null || value === undefined) return absent('the owner has written no description')
  return known(text(at(value, 0, 0)), `the owner's description: ${UNREADABLE}`)
}

/**
 * Maps names the owner ("<name> (Owner)") only for a place someone has claimed. Without it the
 * place may be unclaimed or simply not say, so absence decides nothing.
 */
function claimed(value: unknown): Known<boolean> {
  return text(at(value, 1)) === null ? missing('Maps sent no owner for this place') : true
}

/** The formatted line at 39, and its parts at 183[1]: [area, street, street, city, postcode…]. */
function address(place: unknown): Known<Address> {
  const formatted = text(at(place, 39))
  if (formatted === null) return missing('Maps sent no street address')
  const parts = at(place, 183, 1)
  const country = text(at(parts, 6))
  return {
    formatted,
    street: text(at(parts, 1)),
    city: text(at(parts, 3)),
    region: text(at(parts, 5)),
    postalCode: text(at(parts, 4)),
    country: country !== null && /^[A-Z]{2}$/.test(country) ? country : null,
  }
}

function location(value: unknown): Known<LatLng> {
  const lat = at(value, 2)
  const lng = at(value, 3)
  if (typeof lat !== 'number' || typeof lng !== 'number') return missing('Maps sent no pin')
  return Math.abs(lat) > 90 || Math.abs(lng) > 180
    ? missing(`the pin: ${UNREADABLE}`)
    : { lat, lng }
}

/**
 * Each day is [name, day number from Monday = 1, date, ranges, …, status], a range being
 * [label, [[open hour, minute], [close hour, minute]]]; a closed day has status 2 and no times.
 */
function hours(value: unknown): Known<Hours> {
  if (!Array.isArray(value)) return missing('Maps sent no opening hours')
  const intervals: OpenInterval[] = []
  const open24h: Weekday[] = []
  for (const row of value) {
    const day = WEEK[Number(at(row, 1)) - 1]
    if (day === undefined) return missing(`the hours: ${UNREADABLE}`)
    if (at(row, 5) === DAY_CLOSED) continue
    const ranges = at(row, 3)
    if (!Array.isArray(ranges) || ranges.length === 0) return missing(`the hours: ${UNREADABLE}`)
    for (const range of ranges) {
      const opens = clock(at(range, 1, 0))
      const closes = clock(at(range, 1, 1))
      if (opens === null || closes === null) return missing(`the hours: ${UNREADABLE}`)
      if (opens.minutes === 0 && closes.minutes === 24 * 60) open24h.push(day)
      else intervals.push({ day, opens: opens.label, closes: closes.label })
    }
  }
  return { intervals, open24h }
}

/** [hour] or [hour, minute]; hour 24 is the end of the day, written 00:00 as Maps shows it. */
function clock(value: unknown): { minutes: number; label: string } | null {
  const hour = at(value, 0)
  const minute = at(value, 1) ?? 0
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  const [h, m] = [hour as number, minute as number]
  if (h < 0 || h > 24 || m < 0 || m > 59) return null
  const label = `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { minutes: h * 60 + m, label }
}

/**
 * Groups are [id, name, attributes]; each attribute keeps at [2][2][3] the label Maps reads to
 * screen readers ("Has wheelchair accessible entrance", "No …"), which says whether it is a yes.
 */
function attributes(value: unknown): Known<readonly AttributeGroup[]> {
  if (!Array.isArray(value)) return missing('Maps sent no attributes')
  const groups: AttributeGroup[] = []
  for (const entry of value) {
    const group = text(at(entry, 1))
    const items = at(entry, 2)
    if (group === null || !Array.isArray(items)) return missing(`the attributes: ${UNREADABLE}`)
    const values = items.map((item) => text(at(item, 2, 2, 3)))
    if (values.some((label) => label === null)) return missing(`the attributes: ${UNREADABLE}`)
    if (values.length > 0) groups.push({ group, values: values as string[] })
  }
  return groups.length > 0 ? groups : missing('Maps sent no attributes')
}

function rating(value: unknown): Known<number> {
  if (typeof value !== 'number') return missing('Maps sent no rating')
  return value >= 1 && value <= 5 ? value : missing(`the rating: ${UNREADABLE}`)
}

function reviewCount(value: unknown): Known<number> {
  if (typeof value !== 'number') return missing('Maps sent no review count')
  return Number.isInteger(value) && value >= 0 ? value : missing(`the count: ${UNREADABLE}`)
}
