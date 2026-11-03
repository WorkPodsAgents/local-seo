import type { Business } from '../business'
import { isMissing } from '../business'
import { plainName } from '../nap'
import type { CheckFn } from './finding'
import { finding, sameStem, wordsOf } from './finding'

/** Legal suffixes and joining words are never stuffing. */
const NEUTRAL = new Set(['the', 'and', 'inc', 'llc', 'ltd', 'llp', 'pvt', 'gmbh', 'company'])
const SEPARATOR = /\s[|–—-]\s|,\s|\(/

/**
 * A heuristic, not a verdict: name words that repeat the city, a category or the target search
 * and are not part of the website's domain. A real name can contain them ("Boston Dental"), so
 * the evidence lists each word for a person to judge.
 */
const nameStuffing: CheckFn = (b, extras) => {
  const brand = brandOf(b)
  const words = wordsOf(b.name).filter((word) => !NEUTRAL.has(word) && !brand.includes(word))
  const places = placesOf(b).flatMap(wordsOf)
  const services = [
    ...(isMissing(b.categories.primary) ? [] : wordsOf(b.categories.primary)),
    ...(isMissing(b.categories.secondary) ? [] : b.categories.secondary.flatMap(wordsOf)),
    ...(extras.keyword === undefined ? [] : wordsOf(extras.keyword)),
  ]
  const placeHits = words.filter((word) => places.includes(word))
  const serviceHits = words.filter((word) => services.some((s) => sameStem(word, s)))
  const hits = [...new Set([...placeHits, ...serviceHits])]
  if (hits.length === 0) {
    return finding('L36', 'pass', 'The name has no place or service words beyond the brand.')
  }
  const evidence = [
    ...placeHits.map((word) => ({ value: word, note: 'a place the business serves' })),
    ...serviceHits.map((word) => ({ value: word, note: 'a category or search word' })),
  ]
  const both = placeHits.length > 0 && serviceHits.length > 0
  const status = both || SEPARATOR.test(b.name) ? 'fail' : 'partial'
  const summary = `The name "${b.name}" contains ${hits.join(', ')}, which may be keyword stuffing.`
  return finding('L36', status, summary, evidence)
}

/** The website's host without "www." and the TLD: words in it are the brand. */
function brandOf(b: Business): string {
  if (isMissing(b.website)) return ''
  try {
    const host = new URL(b.website).hostname.replace(/^www\./, '')
    return host.split('.').slice(0, -1).join('.').toLowerCase()
  } catch {
    return ''
  }
}

function placesOf(b: Business): string[] {
  return [
    ...(isMissing(b.address) ? [] : [b.address.city, b.address.region]),
    ...(isMissing(b.serviceAreas) ? [] : b.serviceAreas),
  ].filter((place): place is string => place !== null)
}

const serviceAreaAddress: CheckFn = (b) => {
  if (isMissing(b.serviceAreas) || b.serviceAreas.length === 0) {
    return finding('L37', 'not_applicable', 'No service areas are listed.')
  }
  if (isMissing(b.address) || b.address.street === null) {
    return finding('L37', 'pass', 'The service-area business shows no street address.')
  }
  const summary =
    'The business lists service areas and shows a street address; this is allowed only when ' +
    'customers are served there.'
  return finding('L37', 'partial', summary, [{ value: b.address.formatted }])
}

const temporaryClosure: CheckFn = (b) =>
  b.closure === 'temporary'
    ? finding('L38', 'fail', 'Google marks the business temporarily closed.')
    : finding('L38', 'pass', 'The business is not marked temporarily closed.')

const duplicates: CheckFn = (b, extras) => {
  if (extras.sameAddress === undefined) {
    return finding('L39', 'not_applicable', 'Other businesses at the address were not read.')
  }
  const own = plainName(b.name)
  const alike = extras.sameAddress.filter((other) => {
    const name = plainName(other.name)
    return name !== '' && (name.includes(own) || own.includes(name))
  })
  if (alike.length === 0) {
    const summary = `${extras.sameAddress.length} other businesses share the address; none alike.`
    return finding('L39', 'pass', summary)
  }
  const evidence = alike.map((other) => ({ value: other.name, note: other.ids.cid ?? '' }))
  return finding(
    'L39',
    'fail',
    `${alike.length} profiles at this address have a similar name.`,
    evidence,
  )
}

export const TRUST: readonly CheckFn[] = [
  nameStuffing,
  serviceAreaAddress,
  temporaryClosure,
  duplicates,
]
