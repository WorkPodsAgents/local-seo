// Whether an AI assistant's answer to a local question recommends a business. Answers list
// businesses as numbered or bulleted lines, or in bold; those names, plus any of the business
// and competitors the caller named, give the order the answer recommends them in.
import type { AiAnswerVisibility } from '../bridge'
import { hasWords, wordsOf } from '../nap/normalize'

export interface VisibilityInput {
  readonly text: string
  readonly citedUrls: readonly string[]
  readonly businessName: string
  readonly competitors: readonly string[]
}

/** Among the first three businesses named counts as recommended. */
const RECOMMENDED_WITHIN = 3
const EXCERPT = 300
const NAME_MAX = 80

export function answerVisibility(input: VisibilityInput): AiAnswerVisibility {
  const named = namesInOrder(input.text, [input.businessName, ...input.competitors])
  const position = named.findIndex((name) => samePlace(name, input.businessName))
  const mentioned = hasWords(input.text, input.businessName)
  const found = position >= 0 || mentioned
  // A business the answer mentions only in passing still counts as named, after the list.
  const rank = position >= 0 ? position + 1 : found ? named.length + 1 : null
  return {
    verdict: rank === null ? 'absent' : rank <= RECOMMENDED_WITHIN ? 'recommended' : 'named',
    position: rank,
    excerpt: found ? passageNaming(input.text, input.businessName) : opening(input.text),
    businessesNamed: position >= 0 || !found ? named : [...named, input.businessName],
    competitorsNamed: input.competitors.filter((name) => hasWords(input.text, name)),
    citedUrls: [...new Set(input.citedUrls)],
  }
}

/** The businesses the answer names, in the order it first names them. */
export function namesInOrder(text: string, known: readonly string[]): string[] {
  const flat = wordsOf(text)
  const candidates = [...listedNames(text), ...known.filter((name) => hasWords(text, name))]
  const placed = candidates
    .map((name) => ({ name, at: wordsOf(name) === '' ? -1 : flat.indexOf(wordsOf(name)) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => a.at - b.at)
  const names: string[] = []
  for (const { name } of placed) {
    if (!names.some((kept) => samePlace(kept, name))) names.push(name)
  }
  return names
}

/** Leading names of list lines ("1. **Acme Plumbing** - ...") and bold spans. */
function listedNames(text: string): string[] {
  const names: string[] = []
  for (const line of text.split('\n')) {
    const item = /^\s*(?:\d+[.)]|[-*•])\s+(.+)$/.exec(line)?.[1]
    if (item === undefined) continue
    const lead =
      item
        .replace(/\*\*/g, '')
        .split(/\s[-–—]\s|:\s|\s\(/)[0]
        ?.trim() ?? ''
    if (looksLikeName(lead)) names.push(lead)
  }
  for (const match of text.matchAll(/\*\*([^*\n]+)\*\*/g)) {
    const bold = match[1]?.replace(/:$/, '').trim() ?? ''
    if (looksLikeName(bold)) names.push(bold)
  }
  return names
}

/** A name starts with a capital or a digit and is short; a sentence in a list is not one. */
function looksLikeName(text: string): boolean {
  return text.length > 1 && text.length <= NAME_MAX && /^[\p{Lu}\d]/u.test(text)
}

/** "Acme" and "Acme Plumbing" are one place; "Ace" and "Space Age" are not. */
function samePlace(a: string, b: string): boolean {
  return hasWords(a, b) || hasWords(b, a)
}

function passageNaming(text: string, name: string): string {
  const passage = text.split(/\n+|(?<=[.!?])\s+/).find((part) => hasWords(part, name))
  return (passage ?? opening(text)).trim().slice(0, EXCERPT)
}

function opening(text: string): string {
  return text.trim().slice(0, EXCERPT)
}
