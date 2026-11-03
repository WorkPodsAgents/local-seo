// Whether an answer names and cites the user's brand and each competitor, with WorkPods'
// PromptVisibility semantics: cited (a citation is on the party's site) wins over named (the
// answer says its name), and neither is absent.
import type { AiAnswer, AnswerEngine } from './answer'
import { bareHost } from './host'

export interface Party {
  readonly name: string
  /** Other names the answer may use, such as "Acme" for "Acme Running". */
  readonly aliases: readonly string[]
  /** Its sites; a citation on one of them or a subdomain counts. */
  readonly domains: readonly string[]
}

export type Visibility = 'cited' | 'named' | 'absent'

export interface PartyScore {
  readonly name: string
  readonly role: 'brand' | 'competitor'
  readonly status: Visibility
  readonly named: boolean
  readonly cited: boolean
  /** 1 for the party the answer names first, 2 for the next; null when not named. */
  readonly mentionOrder: number | null
  /** The sentence of the first mention; null when not named. */
  readonly passage: string | null
  readonly citedUrls: readonly string[]
}

export interface ScoredAnswer {
  readonly engine: AnswerEngine
  readonly prompt: string
  readonly capturedAt: string
  /** The brand first, then the competitors in the order given. */
  readonly parties: readonly PartyScore[]
}

const MAX_PASSAGE = 300

export function scoreAnswer(
  answer: AiAnswer,
  parties: { readonly brand: Party; readonly competitors: readonly Party[] },
): ScoredAnswer {
  const all = [
    { party: parties.brand, role: 'brand' as const },
    ...parties.competitors.map((party) => ({ party, role: 'competitor' as const })),
  ]
  const found = all.map(({ party, role }) => ({
    party,
    role,
    at: firstMention(answer.text, [party.name, ...party.aliases]),
    citedUrls: answer.citations
      .map((citation) => citation.url)
      .filter((url) => citesParty(url, party.domains)),
  }))
  const order = found
    .flatMap((entry) => (entry.at === null ? [] : [entry.at]))
    .sort((a, b) => a - b)
  return {
    engine: answer.engine,
    prompt: answer.prompt,
    capturedAt: answer.capturedAt,
    parties: found.map(({ party, role, at, citedUrls }) => {
      const named = at !== null
      const cited = citedUrls.length > 0
      return {
        name: party.name,
        role,
        status: cited ? 'cited' : named ? 'named' : 'absent',
        named,
        cited,
        mentionOrder: at === null ? null : order.indexOf(at) + 1,
        passage: at === null ? null : sentenceAt(answer.text, at),
        citedUrls,
      }
    }),
  }
}

/** The index of the earliest whole-word, case-insensitive match of any name; null when none. */
function firstMention(text: string, names: readonly string[]): number | null {
  let first: number | null = null
  for (const name of names) {
    const tokens = name.trim().split(/\s+/).filter(Boolean).map(escapeRegExp)
    if (tokens.length === 0) continue
    // Letters and digits on either side mean the name sits inside another word.
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${tokens.join('\\s+')}(?![\\p{L}\\p{N}])`, 'iu')
    const index = text.search(pattern)
    if (index >= 0 && (first === null || index < first)) first = index
  }
  return first
}

function citesParty(url: string, domains: readonly string[]): boolean {
  const host = bareHost(url)
  return domains.some((domain) => {
    const own = bareHost(domain)
    return own !== '' && (host === own || host.endsWith(`.${own}`))
  })
}

/** The sentence or list line around `index`, whitespace collapsed. */
function sentenceAt(text: string, index: number): string {
  const before = text.slice(0, index)
  const start = Math.max(...[/[.!?]\s/g, /\n/g].map((re) => lastEnd(before, re)), 0)
  const after = text.slice(index)
  const end = after.search(/[.!?](\s|$)|\n/)
  const sentence = text.slice(start, end < 0 ? text.length : index + end + 1)
  const clean = sentence.replace(/\s+/g, ' ').trim()
  return clean.length > MAX_PASSAGE ? `${clean.slice(0, MAX_PASSAGE - 3)}...` : clean
}

function lastEnd(text: string, pattern: RegExp): number {
  let end = 0
  for (const match of text.matchAll(pattern)) end = match.index + match[0].length
  return end
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
