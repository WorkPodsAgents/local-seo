import type { Known } from '../business'
import { isMissing } from '../business'
import { localThreshold } from '../registry'
import type { CheckFn, LocalFinding } from './finding'
import { finding, graded, presence, sameStem, unknown, wordsOf } from './finding'

const described: CheckFn = (b) =>
  presence('L11', b.description, 'Description', (value) => value.slice(0, 120))

const length: CheckFn = (b) => {
  if (isMissing(b.description)) {
    return finding('L12', 'not_applicable', 'There is no description to measure.')
  }
  const chars = b.description.length
  const min = localThreshold('L12', 'min')
  const max = localThreshold('L12', 'max')
  const summary = `The description is ${chars} characters.`
  return finding('L12', chars >= min && chars <= max ? 'pass' : 'partial', summary)
}

const namesServiceAndPlace: CheckFn = (b, extras) => {
  if (isMissing(b.description)) {
    return finding('L13', 'not_applicable', 'There is no description to read.')
  }
  const service = [
    ...(isMissing(b.categories.primary) ? [] : wordsOf(b.categories.primary)),
    ...(extras.keyword === undefined ? [] : wordsOf(extras.keyword)),
  ]
  const places = [
    ...(isMissing(b.address) || b.address.city === null ? [] : [b.address.city]),
    ...(isMissing(b.serviceAreas) ? [] : b.serviceAreas),
  ]
  if (service.length === 0 || places.length === 0) {
    return finding('L13', 'not_applicable', 'The category or the place served is not known.')
  }
  const words = wordsOf(b.description)
  const text = b.description.toLowerCase()
  const hasService = service.some((s) => words.some((word) => sameStem(word, s)))
  const hasPlace = places.some((place) => text.includes(place.toLowerCase()))
  const status = hasService && hasPlace ? 'pass' : hasService || hasPlace ? 'partial' : 'fail'
  const named = [hasService ? 'the service' : null, hasPlace ? 'the place' : null].filter(Boolean)
  const summary =
    named.length === 0
      ? 'The description names neither the service nor the place.'
      : `The description names ${named.join(' and ')}.`
  return finding('L13', status, summary)
}

function counted(
  checkId: string,
  value: Known<readonly unknown[]>,
  what: string,
  size: (items: readonly unknown[]) => number,
): LocalFinding {
  if (isMissing(value)) return unknown(checkId, what, value.reason)
  const count = size(value)
  const min = localThreshold(checkId, 'min')
  return finding(checkId, graded(count, 1, min), `${count} ${what.toLowerCase()} listed.`)
}

const attributes: CheckFn = (b) =>
  counted('L14', b.attributes, 'Attributes', (groups) =>
    groups.reduce<number>(
      (sum, group) => sum + (group as { values: readonly string[] }).values.length,
      0,
    ),
  )

const services: CheckFn = (b) => counted('L15', b.services, 'Services', (items) => items.length)

const products: CheckFn = (b) => {
  if (isMissing(b.products)) return unknown('L16', 'Products', b.products.reason)
  const count = b.products.length
  return finding('L16', count > 0 ? 'pass' : 'partial', `${count} products listed.`)
}

export const CONTENT: readonly CheckFn[] = [
  described,
  length,
  namesServiceAndPlace,
  attributes,
  services,
  products,
]
