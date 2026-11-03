// Prompts for the AI writers: a business description, a post, a reply to a review and a services
// list. Each prompt carries only facts the extension read from the profile, and tells the model
// to invent nothing, because a draft the owner pastes becomes a public claim about the business.
// The model's text is cut to Google's limits here, so a long answer cannot fail on paste.
import type { Business, Known, Review } from '../business'
import { isMissing } from '../business'
import { profileSlots } from '../nap/hours'

export type DraftKind = 'description' | 'post' | 'review_reply' | 'services'

/** Google's limits: 750 characters for a description, 1,500 for a post. */
export const DRAFT_LIMIT: Readonly<Record<DraftKind, number>> = {
  description: 750,
  post: 1500,
  // Google allows 4,096; a reply people read is far shorter.
  review_reply: 1000,
  // Per service name, as the profile editor's field takes it.
  services: 120,
}

/** At most this many services are proposed; the editor lists them one by one. */
export const MAX_SERVICES = 20

export interface DraftRequest {
  readonly kind: DraftKind
  readonly business: Business
  /** The review to answer; required for review_reply. */
  readonly review?: Review
  /** What the post is about ("winter boiler checks"); the model picks a timely topic without. */
  readonly topic?: string
  /** The search the business wants to be found for; used as words, never stuffed. */
  readonly keyword?: string
}

export interface DraftPrompt {
  readonly system: string
  readonly user: string
  readonly maxChars: number
}

const RULES = [
  'Use only the facts given. Never invent prices, awards, years in business, staff names, ' +
    'certifications, guarantees or offers.',
  'Write plainly, as the owner would. No hashtags, no emoji, no exclamation marks in a row, ' +
    'no keyword lists.',
  'Answer with the text only: no title, no quotes around it, no notes to the user.',
]

const TASK: Readonly<Record<DraftKind, (request: DraftRequest) => string>> = {
  description: () =>
    `Write the business description for this Google Business Profile, at most ` +
    `${DRAFT_LIMIT.description} characters. Say what the business does, for whom and where, ` +
    'in the first 250 characters, since Google cuts the rest behind "More". No URLs, phone ' +
    'numbers or links: Google rejects descriptions with them.',
  post: (request) =>
    `Write one Google Business Profile post, at most ${DRAFT_LIMIT.post} characters, ideally ` +
    `150 to 300 words. Topic: ${topicOf(request)}. End with one clear next step. No phone ` +
    'numbers in the text: Google rejects posts with them; the call button does that job.',
  review_reply: () =>
    `Write the owner's reply to this review, at most ${DRAFT_LIMIT.review_reply} characters, ` +
    'two to four sentences. Thank the reviewer, answer what they raised, and for a complaint ' +
    'offer to continue offline without admitting fault. Never repeat personal or health ' +
    'details from the review, and never name the reviewer beyond their first name.',
  services: () =>
    `List up to ${MAX_SERVICES} services this business plausibly offers under its categories, ` +
    `one per line, each at most ${DRAFT_LIMIT.services} characters, most important first. ` +
    'Start with the services it already lists. Plain names only: no prices, no descriptions, ' +
    'no numbering.',
}

function topicOf(request: DraftRequest): string {
  const topic = request.topic?.trim() ?? ''
  return topic === '' ? 'a timely, useful update about a service the business lists' : topic
}

export function draftPrompt(request: DraftRequest): DraftPrompt {
  if (request.kind === 'review_reply' && request.review === undefined) {
    throw new Error('A reply draft needs the review it answers.')
  }
  const system =
    'You draft Google Business Profile content for a local business owner, who reviews and ' +
    `pastes it themselves.\n${RULES.map((rule) => `- ${rule}`).join('\n')}`
  const parts = [TASK[request.kind](request), '', 'Business facts:', ...facts(request.business)]
  if (request.keyword !== undefined && request.keyword.trim() !== '') {
    parts.push(`- Search it wants to be found for: ${request.keyword.trim()}`)
  }
  if (request.review !== undefined) {
    parts.push('', 'The review:', ...reviewLines(request.review))
  }
  return { system, user: parts.join('\n'), maxChars: DRAFT_LIMIT[request.kind] }
}

function facts(business: Business): string[] {
  const lines = [`- Name: ${business.name}`]
  const add = <T>(label: string, value: Known<T>, show: (known: T) => string | null) => {
    if (isMissing(value)) return
    const text = show(value)
    if (text !== null && text !== '') lines.push(`- ${label}: ${text}`)
  }
  add('Primary category', business.categories.primary, (value) => value)
  add('Other categories', business.categories.secondary, (list) => list.join(', '))
  add('Address', business.address, (address) => address.formatted)
  add('Service areas', business.serviceAreas, (list) => list.join(', '))
  add('Hours', business.hours, (hours) => profileSlots(hours).join('; '))
  add('Services listed', business.services, (list) => list.join(', '))
  add('Products listed', business.products, (list) => list.join(', '))
  add('Attributes', business.attributes, (groups) =>
    groups.map((group) => `${group.group}: ${group.values.join(', ')}`).join('; '),
  )
  add('Current description', business.description, (text) => text)
  add('Rating', business.rating, (rating) =>
    isMissing(business.reviewCount) ? `${rating}` : `${rating} from ${business.reviewCount}`,
  )
  return lines
}

function reviewLines(review: Review): string[] {
  return [
    `- Rating: ${review.rating} of 5`,
    `- Text: ${review.text ?? '(no text, rating only)'}`,
    ...(review.ownerReply === null ? [] : [`- Earlier reply: ${review.ownerReply.text}`]),
  ]
}

/**
 * The model's answer as a draft within `maxChars`: quotes and a leading label stripped, and a
 * long answer cut at the last sentence that fits, never mid-word.
 */
export function fitDraft(text: string, maxChars: number): string {
  const clean = text
    .trim()
    .replace(/^(here is|here's)[^\n]*:\s*\n/i, '')
    .replace(/^["“](.*)["”]$/s, '$1')
    .trim()
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars)
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'), cut.lastIndexOf('! '))
  if (sentence > maxChars / 2) return cut.slice(0, sentence + 1).trim()
  const space = cut.lastIndexOf(' ')
  return (space > 0 ? cut.slice(0, space) : cut).trim()
}

/** A services answer as names: bullets and numbering stripped, each cut, at most MAX_SERVICES. */
export function servicesOf(text: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const line of text.split('\n')) {
    const name = fitDraft(line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ''), DRAFT_LIMIT.services)
    const key = name.toLowerCase()
    if (name === '' || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names.slice(0, MAX_SERVICES)
}
