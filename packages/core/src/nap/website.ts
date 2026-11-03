// Does the website say what the profile says? Reads the page's LocalBusiness or Organization
// schema, tel: links and visible text, and compares name, address, phone and hours one by one.
import type { PageSnapshot } from '@open-agent-ready/core'
import type { Business, Known } from '../business'
import { isMissing } from '../business'
import { visibleText } from '../../../../vendor/agent-ready/packages/core/src/page/dom'
import {
  bareType,
  structuredData,
  typesOf,
} from '../../../../vendor/agent-ready/packages/core/src/page/schema'
import type { JsonObject } from '../../../../vendor/agent-ready/packages/core/src/page/schema'
import { profileSlots, schemaSlots } from './hours'
import {
  hasWords,
  normalizeAddress,
  normalizePhone,
  plainName,
  samePhone,
  streetKey,
} from './normalize'

/**
 * `match`: the site shows the profile's value. `mismatch`: the site states the field and none of
 * it matches; for the phone, only schema telephone and tel: links can state it, since numbers in
 * page text may be someone else's. `not_found`: the site does not state it. `profile_missing`:
 * nothing to compare.
 */
export type FieldStatus = 'match' | 'mismatch' | 'not_found' | 'profile_missing'

export interface FieldCheck {
  readonly status: FieldStatus
  /** The profile's value as compared. */
  readonly profile: string | null
  /** What the site states for this field, as found. */
  readonly found: readonly string[]
}

export interface LocalSchema {
  /** The LocalBusiness (or subtype) types declared. */
  readonly types: readonly string[]
  /** Of name, address, telephone, geo and openingHours, those the entity lacks. */
  readonly missing: readonly string[]
}

export interface WebsiteCheck {
  readonly url: string
  readonly name: FieldCheck
  readonly address: FieldCheck
  readonly phone: FieldCheck
  /** Compared against schema hours only; hours written as page text are not read. */
  readonly hours: FieldCheck
  /** Null when the page declares no LocalBusiness entity. */
  readonly localSchema: LocalSchema | null
  readonly telLinks: readonly string[]
  readonly embeddedMap: boolean
}

/** LocalBusiness and the subtypes local sites use most; any type ending in these words counts. */
const LOCAL_TYPE = new RegExp(
  '^(LocalBusiness|Restaurant|Dentist|Physician|Plumber|Electrician|Locksmith|RoofingContractor|' +
    'HVACBusiness|GeneralContractor|AutoRepair|AutoDealer|Hotel|Attorney|LegalService|' +
    'RealEstateAgent|BeautySalon|HairSalon|DaySpa|Bakery|CafeOrCoffeeShop|BarOrPub|' +
    'MedicalClinic|Pharmacy|VeterinaryCare|ChildCare|Library)$|(Store|Business|Service|Clinic)$',
)
const ORGANIZATION = /^(Organization|Corporation)$/
const LOCAL_FIELDS: readonly (readonly string[])[] = [
  ['name'],
  ['address'],
  ['telephone'],
  ['geo'],
  ['openingHoursSpecification', 'openingHours'],
]

/**
 * Numbers in page text that look like phones: international with a leading +, a North American
 * 3-3-4 number, or a national number with a trunk 0. Year ranges ("2019-2024") and ZIP+4 codes
 * ("10994-1234") have neither shape.
 */
const PHONE_TEXT = new RegExp(
  [
    String.raw`\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,5}`,
    String.raw`(?<![\d+])(?:1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)`,
    String.raw`(?<![\d+])0\d{1,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\d)`,
  ].join('|'),
  'g',
)
const DATE_LIKE = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/

export function checkWebsite(business: Business, snapshot: PageSnapshot): WebsiteCheck {
  const doc = snapshot.rendered ?? snapshot.raw
  const entities = structuredData(doc).entities
  const local = entities.filter((entity) => types(entity).some((type) => LOCAL_TYPE.test(type)))
  const named = local.length > 0 ? local : entities.filter((e) => types(e).some(isOrganization))
  const text = visibleText(doc)
  const telLinks = Array.from(doc.querySelectorAll('a[href^="tel:"]')).map((link) =>
    decodeURIComponent((link.getAttribute('href') ?? '').slice(4)).trim(),
  )
  const first = local[0]
  return {
    url: snapshot.url,
    name: nameCheck(business.name, named, doc.title, text),
    address: addressCheck(business.address, named, text),
    phone: phoneCheck(business.phone, named, telLinks, text),
    hours: hoursCheck(business.hours, named),
    localSchema:
      first === undefined
        ? null
        : {
            types: [...new Set(local.flatMap(types))],
            missing: LOCAL_FIELDS.filter(
              (anyOf) => !anyOf.some((field) => present(first, field)),
            ).map((anyOf) => anyOf.join('|')),
          },
    telLinks,
    embeddedMap:
      doc.querySelector(
        'iframe[src*="google.com/maps"], iframe[src*="maps.google."], iframe[src*="goo.gl/maps"]',
      ) !== null,
  }
}

function types(entity: JsonObject): string[] {
  return typesOf(entity['@type']).map(bareType)
}

function isOrganization(type: string): boolean {
  return ORGANIZATION.test(type)
}

function present(entity: JsonObject, field: string): boolean {
  const value = entity[field]
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function strings(entities: readonly JsonObject[], field: string): string[] {
  return entities.flatMap((entity) => {
    const value = entity[field]
    const all = Array.isArray(value) ? value : [value]
    return all.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
  })
}

function nameCheck(
  profile: string,
  entities: readonly JsonObject[],
  title: string,
  text: string,
): FieldCheck {
  const found = strings(entities, 'name')
  // "Rusty-Brick" and "RustyBrick" are the same name; otherwise names match on whole words.
  const holds = (candidate: string) =>
    hasWords(candidate, profile) ||
    hasWords(profile, candidate) ||
    (plainName(candidate) !== '' && plainName(candidate) === plainName(profile))
  if (found.some(holds) || [title, text].some((t) => hasWords(t, profile))) {
    return { status: 'match', profile, found }
  }
  return { status: found.length > 0 ? 'mismatch' : 'not_found', profile, found }
}

function addressCheck(
  address: Business['address'],
  entities: readonly JsonObject[],
  text: string,
): FieldCheck {
  if (isMissing(address)) return { status: 'profile_missing', profile: null, found: [] }
  const street = streetKey(address.street ?? address.formatted.split(',')[0] ?? '')
  const found = entities.flatMap((entity) => addressesOf(entity['address']))
  const holds = (candidate: string) =>
    street !== '' && ` ${normalizeAddress(candidate)} `.includes(` ${street} `)
  if (found.some(holds) || holds(text)) {
    return { status: 'match', profile: address.formatted, found }
  }
  return { status: found.length > 0 ? 'mismatch' : 'not_found', profile: address.formatted, found }
}

function addressesOf(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(addressesOf)
  if (typeof value !== 'object' || value === null) return []
  const parts = ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode']
    .map((field) => (value as Record<string, unknown>)[field])
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
  return parts.length === 0 ? [] : [parts.join(', ')]
}

function phoneCheck(
  phone: Known<string>,
  entities: readonly JsonObject[],
  telLinks: readonly string[],
  text: string,
): FieldCheck {
  if (isMissing(phone)) return { status: 'profile_missing', profile: null, found: [] }
  const shown = (text.match(PHONE_TEXT) ?? [])
    .map((entry) => entry.trim())
    .filter((entry) => !DATE_LIKE.test(entry) && entry.replace(/\D/g, '').length >= 8)
  const stated = [...strings(entities, 'telephone'), ...telLinks]
  const found = [...new Set([...stated, ...shown])]
  const profile = normalizePhone(phone)
  if (found.some((entry) => samePhone(entry, phone))) return { status: 'match', profile, found }
  return { status: stated.length > 0 ? 'mismatch' : 'not_found', profile, found }
}

function hoursCheck(hours: Business['hours'], entities: readonly JsonObject[]): FieldCheck {
  if (isMissing(hours)) return { status: 'profile_missing', profile: null, found: [] }
  const wanted = profileSlots(hours)
  const found = schemaSlots(entities)
  const profile = wanted.join('; ')
  if (found.length === 0) return { status: 'not_found', profile, found }
  const same = found.length === wanted.length && found.every((slot, at) => slot === wanted[at])
  return { status: same ? 'match' : 'mismatch', profile, found }
}
