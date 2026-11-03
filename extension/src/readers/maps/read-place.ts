// Reads the place open in Google Maps into the shared Business shape, from the place panel's
// accessibility labels and data attributes and the ids in the address, then fills what the panel
// does not draw from the place data Maps fetched for it (place-data.ts). Each field says why it
// is missing: a tab that is not open, Maps' signed-out "limited view", or a value Maps never shows.
import {
  absent,
  isMissing,
  missing,
  type Address,
  type AttributeGroup,
  type Business,
  type BusinessIds,
  type Hours,
  type Known,
} from '@local-seo/core/business'
import { featureIdFromUrl, idsFromUrl, placeNameFromUrl, placePointFromUrl } from '../google-urls'
import { readHours } from './hours'
import { languageName, mapsLanguage, readsAsEnglish } from './language'
import { countIn, isLimitedView, placePanel, ratingIn, squash, visibleText } from './page'
import { parsePlaceData, type PlaceData } from './place-data'

const OVERVIEW_CLOSED = 'the Overview tab of the place is not open'
const ABOUT_CLOSED = 'the About tab of the place is not open'
const NO_RATING_VIEW = 'neither the Overview nor the Reviews tab of the place is open'
// Maps draws only the primary category; the rest come only with its place data.
const NO_PLACE_DATA = 'Reload the Maps page so Local SEO can read the full profile'
const OTHER_PLACE_DATA = 'Maps sent its place data in a form Local SEO cannot read'
const NOT_ON_PANEL = 'Maps does not show this on the place panel'
const LIMITED_DESCRIPTION =
  "Maps leaves the owner's description out of its limited view; sign in to Google to see it"
const NO_DESCRIPTION = "no owner's description is shown on the place panel"
const LIMITED_CLAIM =
  'Maps leaves the claim prompt out of its limited view, so claim status cannot be told'

/**
 * The place in the Maps tab, or null when the address is not a place or its panel is not open.
 * `placeBody` is the `/maps/preview/place` response the page hook kept for it, if any.
 */
export function readMapsPlace(
  doc: Document,
  url: string,
  now: Date,
  placeBody: string | null,
): Business | null {
  const shown = readPanel(doc, url, now)
  if (shown === null) return null
  if (placeBody === null || shown.ids.featureId === null) {
    return withSecondary(shown, missing(NO_PLACE_DATA))
  }
  const data = parsePlaceData(placeBody, shown.ids.featureId)
  return data === null ? withSecondary(shown, missing(OTHER_PLACE_DATA)) : merged(shown, data)
}

/**
 * True when the place was read without the place data Maps fetches as its panel opens: a place
 * reached through a redirect (`?cid=`) comes with the page instead, so a fresh load of its own
 * address is what makes Maps fetch it.
 */
export function lacksPlaceData(place: Business): boolean {
  const secondary = place.categories.secondary
  return isMissing(secondary) && secondary.reason === NO_PLACE_DATA
}

function withSecondary(place: Business, secondary: Business['categories']['secondary']): Business {
  return { ...place, categories: { ...place.categories, secondary } }
}

/**
 * The panel stays the source for what it shows; the place data adds what it never draws (the
 * secondary categories, and in the limited view the description and the owner) and fills any
 * field the panel did not give.
 */
function merged(shown: Business, data: PlaceData): Business {
  const categories = data.categories
  const primary = isMissing(categories) ? categories : (categories[0] as string)
  const secondary = isMissing(categories)
    ? categories
    : categories.length > 1
      ? categories.slice(1)
      : absent('no secondary categories are listed')
  return {
    ...shown,
    ids: {
      placeId: shown.ids.placeId ?? data.ids.placeId,
      cid: shown.ids.cid ?? data.ids.cid,
      kgId: shown.ids.kgId ?? data.ids.kgId,
      featureId: shown.ids.featureId,
    },
    categories: { primary: filled(shown.categories.primary, primary), secondary },
    address: mergedAddress(shown.address, data.address),
    location: filled(shown.location, data.location),
    phone: filled(shown.phone, data.phone),
    website: filled(shown.website, data.website),
    hours: filled(shown.hours, data.hours),
    attributes: filled(shown.attributes, data.attributes),
    description: isMissing(shown.description) ? data.description : shown.description,
    rating: filled(shown.rating, data.rating),
    reviewCount: filled(shown.reviewCount, data.reviewCount),
    claimed: filled(shown.claimed, data.claimed),
  }
}

/**
 * The panel's value, or the place data's where the panel could not tell. A value the panel was
 * read and does not list stays absent: that is what Google shows the public, as a service-area
 * business's hidden address.
 */
function filled<T>(shown: Known<T>, data: Known<T>): Known<T> {
  return isMissing(shown) && shown.absent !== true && !isMissing(data) ? data : shown
}

/** The panel's one line as shown, with the parts only the place data splits out. */
function mergedAddress(shown: Known<Address>, data: Known<Address>): Known<Address> {
  if (isMissing(shown)) return filled(shown, data)
  return isMissing(data) ? shown : { ...data, formatted: shown.formatted }
}

function readPanel(doc: Document, url: string, now: Date): Business | null {
  const urlName = placeNameFromUrl(url)
  const panel = placePanel(doc)
  if (urlName === null || panel === null) return null
  const limited = isLimitedView(doc)
  const overview = overviewOpen(panel)
  // Labels Maps writes only as text are matched in English; elsewhere they say why, never guess.
  const language = mapsLanguage(doc, url)
  const foreign = language === null || readsAsEnglish(language) ? null : notEnglish(language)
  // The header (rating, category) and the info rows render only while the Overview tab is open.
  const onOverview = <T>(read: () => Known<T>): Known<T> =>
    overview ? read() : missing(OVERVIEW_CLOSED)
  const texts = leaves(panel)
  return {
    source: 'maps_page',
    readAt: now.toISOString(),
    ids: placeIds(doc, url),
    name: squash(panel.getAttribute('aria-label') ?? '') || urlName,
    categories: {
      primary: onOverview(() => primaryCategory(panel)),
      secondary: missing(NO_PLACE_DATA),
    },
    address: onOverview(() => address(panel)),
    serviceAreas: missing(NOT_ON_PANEL),
    location: placePointFromUrl(url) ?? missing('the address carries no place coordinates'),
    phone: onOverview(() => phone(panel)),
    website: onOverview(() => website(panel)),
    hours: onOverview(() => hours(panel, foreign)),
    attributes: attributes(panel),
    services: missing(NOT_ON_PANEL),
    products: missing(NOT_ON_PANEL),
    description: missing(limited ? LIMITED_DESCRIPTION : NO_DESCRIPTION),
    rating: rating(panel, overview),
    reviewCount: reviewCount(panel, texts, overview, foreign),
    photoCount: onOverview(() => photoCount(texts, foreign)),
    claimed: claimed(panel, texts, overview, limited, foreign),
    closure: closure(texts),
  }
}

/** The Overview tab is the first tab; a place with no tabs shows its overview alone. */
function overviewOpen(panel: Element): boolean {
  const first = panel.querySelector('[role="tab"][data-tab-index="0"]')
  if (first !== null) return first.getAttribute('aria-selected') === 'true'
  return panel.querySelector('h1') !== null
}

/**
 * The address gives the feature id, KG id and the CID inside the feature id; the place id is
 * only in the link of the place's own card, when the results list is still on the page.
 */
function placeIds(doc: Document, url: string): BusinessIds {
  const ids = idsFromUrl(url)
  if (ids.featureId === null) return ids
  const card = Array.from(doc.querySelectorAll('a[href*="/maps/place/"]'))
    .map((link) => link.getAttribute('href') ?? '')
    .find((href) => featureIdFromUrl(href) === ids.featureId)
  if (card === undefined) return ids
  const fromCard = idsFromUrl(card)
  return {
    placeId: ids.placeId ?? fromCard.placeId,
    cid: ids.cid ?? fromCard.cid,
    kgId: ids.kgId ?? fromCard.kgId,
    featureId: ids.featureId,
  }
}

function primaryCategory(panel: Element): Known<string> {
  // The category is a button whose action Maps names `….category`; it has no label of its own.
  const button = panel.querySelector('button[jsaction$=".category"]')
  const text = button === null ? '' : squash(visibleText(button))
  return text === '' ? absent('no category is shown') : text
}

/** An info row's value, from a label such as "Address: …" in whatever language Maps uses. */
function infoValue(panel: Element, selector: string): string | null {
  const row = panel.querySelector(selector)
  if (row === null) return null
  const label = row.getAttribute('aria-label') ?? ''
  const colon = label.search(/[:：]/)
  const value = squash(colon === -1 ? visibleText(row) : label.slice(colon + 1))
  return value === '' ? null : value
}

function address(panel: Element): Known<Address> {
  const formatted = infoValue(panel, '[data-item-id="address"]')
  if (formatted === null) {
    return absent('no street address is listed, as for a service-area business')
  }
  // Maps shows one line in the country's own order; splitting it would be a guess.
  return { formatted, street: null, city: null, region: null, postalCode: null, country: null }
}

function phone(panel: Element): Known<string> {
  return infoValue(panel, '[data-item-id^="phone:"]') ?? absent('no phone number is listed')
}

function website(panel: Element): Known<string> {
  const href = panel.querySelector('a[data-item-id="authority"]')?.getAttribute('href') ?? ''
  return href === '' ? absent('no website is listed') : href
}

function hours(panel: Element, foreign: string | null): Known<Hours> {
  const read = readHours(panel)
  switch (read.kind) {
    case 'hours':
      return read.hours
    case 'none':
      return absent('no opening hours are listed')
    case 'unreadable':
      return missing(foreign ?? `the hours are in a form this reader cannot read: "${read.text}"`)
  }
}

/**
 * The About tab's groups ("Accessibility", "Amenities") with each value as Maps labels it for
 * screen readers ("Has wheelchair accessible entrance", "No …"), which keeps whether it is a yes.
 */
function attributes(panel: Element): Known<readonly AttributeGroup[]> {
  const groups: AttributeGroup[] = []
  for (const heading of Array.from(panel.querySelectorAll('[role="region"] h2'))) {
    const list = heading.parentElement?.querySelector('ul') ?? null
    if (list === null) continue
    const values = Array.from(list.querySelectorAll('li'))
      .map((item) => {
        const labelled = item.querySelector('[aria-label]')?.getAttribute('aria-label')
        return squash(labelled ?? visibleText(item))
      })
      .filter((value) => value !== '')
    if (values.length > 0) groups.push({ group: squash(visibleText(heading)), values })
  }
  return groups.length > 0 ? groups : missing(ABOUT_CLOSED)
}

/** The header's "4.7 stars" or the Reviews tab's summary; a histogram row is a whole number. */
function rating(panel: Element, overview: boolean): Known<number> {
  for (const image of Array.from(panel.querySelectorAll('[role="img"][aria-label]'))) {
    const value = ratingIn(image.getAttribute('aria-label') ?? '')
    if (value !== null) return value
  }
  return overview ? absent('no rating is shown, as for a place with no reviews') : noRatingView()
}

/**
 * The header shows the count as "(181)" in any language; the Reviews tab writes "181 reviews"
 * with no hook, so that fallback reads the English wording.
 */
function reviewCount(
  panel: Element,
  texts: readonly string[],
  overview: boolean,
  foreign: string | null,
): Known<number> {
  for (const image of Array.from(panel.querySelectorAll('[role="img"]'))) {
    const shown = /^\(([\d,.\s]+)\)$/.exec(squash(visibleText(image)))?.[1]
    const count = shown === undefined ? null : countIn(shown)
    if (count !== null) return count
  }
  const count = countBefore(texts, /^([\d,.]+) reviews?$/i)
  if (count !== null) return count
  if (foreign !== null) return missing(foreign)
  return overview ? absent('no reviews are shown') : noRatingView()
}

function noRatingView(): Known<number> {
  return missing(NO_RATING_VIEW)
}

/** The photo strip's "959 Photos"; Maps words it only in text, so this reads English. */
function photoCount(texts: readonly string[], foreign: string | null): Known<number> {
  return (
    countBefore(texts, /^([\d,.]+) photos?$/i) ??
    missing(foreign ?? 'the panel shows no photo count')
  )
}

/** Why a field Maps words only in text is unknown on a page in another language. */
function notEnglish(language: string): string {
  return (
    `Maps shows this page in ${languageName(language)}, and Local SEO reads this field only ` +
    'in English; open Maps in English (hl=en) to read it'
  )
}

function countBefore(texts: readonly string[], pattern: RegExp): number | null {
  for (const text of texts) {
    const shown = pattern.exec(text)?.[1]
    const count = shown === undefined ? null : countIn(shown)
    if (count !== null) return count
  }
  return null
}

/**
 * An unclaimed place shows "Claim this business" (or "Own this business?"); a claimed one shows
 * nothing, so only a full view without the prompt says the place is claimed.
 */
function claimed(
  panel: Element,
  texts: readonly string[],
  overview: boolean,
  limited: boolean,
  foreign: string | null,
): Known<boolean> {
  const prompt =
    panel.querySelector('[data-item-id="merchant"]') !== null ||
    texts.some((text) => /^(claim this business|own this business\??)$/i.test(text))
  if (prompt) return false
  if (limited) return missing(LIMITED_CLAIM)
  // The prompt and the limited-view banner are matched in English, so their absence says nothing.
  if (foreign !== null) return missing(foreign)
  return overview ? true : missing(OVERVIEW_CLOSED)
}

/** Matched as a whole label, so a review that mentions "temporarily closed" does not count. */
function closure(texts: readonly string[]): Business['closure'] {
  if (texts.some((text) => /^permanently closed$/i.test(text))) return 'permanent'
  if (texts.some((text) => /^temporarily closed$/i.test(text))) return 'temporary'
  return null
}

/** The visible text of every element with no child elements, for labels Maps writes as text. */
function leaves(panel: Element): string[] {
  return Array.from(panel.querySelectorAll('*'))
    .filter((element) => element.children.length === 0)
    .map((element) => squash(visibleText(element)))
    .filter((text) => text !== '')
}
