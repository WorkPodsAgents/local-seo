// What reviewers talk about: words and two-word phrases counted once per review, so one long
// review cannot make a theme on its own.
import type { Review } from '../business'

const STOPWORDS = new Set(
  (
    'a about above after again against all also am an and any are as at be because been before ' +
    'being below between both but by can could did do does doing down during each even ever few ' +
    'for from further get got had has have having he her here hers him his how i if in into is ' +
    'it its itself just let me more most my no nor not now of off on once only or other our ' +
    'ours out over own really same she should so some such than that the their theirs them ' +
    'then there these they this those through to too under until up us very was we were what ' +
    'when where which while who whom why will with would you your yours yourself ve ll re don ' +
    'didn doesn isn wasn weren won wouldn couldn shouldn one two go went come came made make ' +
    'well much many still back time place way thing things'
  ).split(' '),
)

export interface Theme {
  /** A word or a two-word phrase, lower-cased. */
  readonly phrase: string
  /** Reviews that mention it. */
  readonly count: number
  /** Up to three ids of reviews that mention it, for quoting. */
  readonly reviewIds: readonly string[]
}

const EXAMPLES = 3
/** A phrase one reviewer used is an anecdote, not a theme. */
const MIN_REVIEWS = 2

export function reviewThemes(reviews: readonly Review[], top = 15): Theme[] {
  const found = new Map<string, { count: number; ids: string[] }>()
  for (const review of reviews) {
    if (review.text === null) continue
    for (const phrase of phrasesOf(review.text)) {
      const entry = found.get(phrase) ?? { count: 0, ids: [] }
      entry.count += 1
      if (review.id !== null && entry.ids.length < EXAMPLES) entry.ids.push(review.id)
      found.set(phrase, entry)
    }
  }
  return [...found.entries()]
    .filter(([, entry]) => entry.count >= MIN_REVIEWS)
    .sort(([a, x], [b, y]) => y.count - x.count || words(b) - words(a) || a.localeCompare(b))
    .slice(0, top)
    .map(([phrase, entry]) => ({ phrase, count: entry.count, reviewIds: entry.ids }))
}

function words(phrase: string): number {
  return phrase.split(' ').length
}

/** Unique words and adjacent word pairs; a stopword breaks a pair. */
function phrasesOf(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []
  const phrases = new Set<string>()
  let previous: string | null = null
  for (const raw of tokens) {
    const token = raw.replace(/'s$/, '').replace(/'/g, '')
    if (token.length < 3 || STOPWORDS.has(token) || /^\d+$/.test(token)) {
      previous = null
      continue
    }
    phrases.add(token)
    if (previous !== null) phrases.add(`${previous} ${token}`)
    previous = token
  }
  return phrases
}
