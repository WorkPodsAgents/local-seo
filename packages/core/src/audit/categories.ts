import { isMissing } from '../business'
import { categoryFrequency } from '../compare'
import { localThreshold } from '../registry'
import type { CheckFn } from './finding'
import { finding, sameStem, unknown, wordsOf } from './finding'

const primary: CheckFn = (b) => {
  const value = b.categories.primary
  if (!isMissing(value)) {
    return finding('L7', 'pass', `The primary category is ${value}.`, [{ value }])
  }
  if (value.absent === true) return finding('L7', 'fail', 'No primary category is set.')
  return unknown('L7', 'The primary category', value.reason)
}

const secondary: CheckFn = (b) => {
  const value = b.categories.secondary
  if (isMissing(value)) return unknown('L8', 'Secondary categories', value.reason)
  const min = localThreshold('L8', 'min')
  const evidence = value.length === 0 ? [] : [{ value: value.join(', ') }]
  const summary = `${value.length} secondary ${value.length === 1 ? 'category' : 'categories'}.`
  if (value.length === 0) return finding('L8', 'fail', 'No secondary categories are set.')
  return finding('L8', value.length >= min ? 'pass' : 'partial', summary, evidence)
}

const fitsKeyword: CheckFn = (b, extras) => {
  if (extras.keyword === undefined) {
    return finding('L9', 'not_applicable', 'No target search was given to compare with.')
  }
  const value = b.categories.primary
  if (isMissing(value)) return unknown('L9', 'The primary category', value.reason)
  const wanted = wordsOf(extras.keyword)
  const shares = (category: string) =>
    wordsOf(category).some((word) => wanted.some((target) => sameStem(word, target)))
  const evidence = [{ value, note: `target search "${extras.keyword}"` }]
  if (shares(value)) {
    return finding('L9', 'pass', 'The primary category matches the target search.', evidence)
  }
  const secondaries = isMissing(b.categories.secondary) ? [] : b.categories.secondary
  const match = secondaries.find(shares)
  if (match !== undefined) {
    const summary = `Only the secondary category ${match} matches the target search.`
    return finding('L9', 'partial', summary, evidence)
  }
  return finding('L9', 'fail', 'No category shares a word with the target search.', evidence)
}

/** Fewer competitors than this make "most of them" meaningless. */
const MIN_COMPETITORS = 3

const sharedCategories: CheckFn = (b, extras) => {
  const rows = (extras.competitors ?? []).filter(
    (row) => !row.sponsored && row.name !== b.name && row.primaryCategory !== null,
  )
  if (rows.length < MIN_COMPETITORS) {
    return finding('L10', 'not_applicable', 'Fewer than 3 competitors with categories were read.')
  }
  const primary = b.categories.primary
  if (isMissing(primary)) return unknown('L10', 'The primary category', primary.reason)
  const own = new Set([
    primary,
    ...(isMissing(b.categories.secondary) ? [] : b.categories.secondary),
  ])
  const share = localThreshold('L10', 'share')
  const lacking = categoryFrequency(rows).filter((u) => u.share >= share && !own.has(u.category))
  if (lacking.length === 0) {
    return finding('L10', 'pass', 'The profile has every category most competitors use.')
  }
  const evidence = lacking.map((use) => ({
    value: use.category,
    note: `used by ${use.usedBy} of ${rows.length}, as primary by ${use.asPrimary}`,
  }))
  const missesPrimary = lacking.some((use) => use.asPrimary * 2 > rows.length)
  const summary = `The profile lacks ${lacking.length} categories most competitors use.`
  return finding('L10', missesPrimary ? 'fail' : 'partial', summary, evidence)
}

export const CATEGORIES: readonly CheckFn[] = [primary, secondary, fitsKeyword, sharedCategories]
