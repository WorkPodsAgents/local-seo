// Cloro asks ChatGPT, Gemini and Google AI Mode a prompt and returns the answer with its sources.
// WorkPods uses Cloro's async batch API with a webhook; an extension cannot receive a webhook, so
// this client calls the synchronous endpoint and waits for the answer. The request (prompt,
// country, Bearer key) and the answer parsing are ported from WorkPods' HttpCloro.kt and
// CloroParser.kt. Failures carry Cloro's HTTP status, never its body.
import type { AiAnswer } from '../../answers/answer'
import type { Paid, ProviderFailure } from '../failure'
import { ProviderError } from '../failure'
import { array, number, object, text } from '../json'
import type { JsonObject } from '../json'
import type { PaidDeps } from '../paid'
import { paidCall } from '../paid'
import type { Clock } from '../store'

export const CLORO_BASE_URL = 'https://api.cloro.dev'

export type CloroEngine = 'chatgpt' | 'gemini' | 'ai_mode'

/** The synchronous endpoint per engine (cloro.dev/docs, checked 1 Nov 2026). */
const SYNC_PATH: Readonly<Record<CloroEngine, string>> = {
  chatgpt: '/v1/monitor/chatgpt',
  gemini: '/v1/monitor/gemini',
  ai_mode: '/v1/monitor/aimode',
}

/**
 * Credits per sync answer: each provider's base cost plus the 2-credit surcharge Cloro adds to
 * every `/v1/monitor/*` call (cloro.dev/docs/guides/providers, checked 1 Nov 2026).
 */
export const ESTIMATED_CREDITS: Readonly<Record<CloroEngine, number>> = {
  chatgpt: 7,
  gemini: 6,
  ai_mode: 6,
}

/**
 * What one Cloro credit costs, so Cloro spend fits the USD cap. VERIFY against the user's plan;
 * Cloro bills in credits and its plans price them differently.
 */
export const CLORO_USD_PER_CREDIT = 0.002

/** A sync answer can take a minute or more while the assistant browses. */
const TIMEOUT_MS = 180_000
const DEFAULT_RETRY_S = 30

export interface CloroDeps extends PaidDeps {
  /** Read from the vault at call time; null when the user has not configured Cloro. */
  readonly apiKey: () => Promise<string | null>
  readonly clock: Clock
}

export interface CloroAsk {
  readonly engine: CloroEngine
  readonly prompt: string
  /** ISO 3166-1 alpha-2 country the assistant answers from; default US. */
  readonly country?: string
}

export interface Cloro {
  ask(request: CloroAsk): Promise<Paid<AiAnswer>>
}

export function createCloro(deps: CloroDeps): Cloro {
  return {
    async ask({ engine, prompt, country = 'US' }) {
      const path = SYNC_PATH[engine]
      const body = { prompt, country: country.toUpperCase() }
      const estimate = ESTIMATED_CREDITS[engine] * CLORO_USD_PER_CREDIT
      const paid = await paidCall(deps, 'cloro', path, body, estimate, async () => {
        const key = await deps.apiKey()
        if (key === null) throw new ProviderError({ code: 'not_configured', provider: 'cloro' })
        const { answer, charged } = await send(key, path, body)
        // A charge Cloro does not report is never read as free.
        const credits = charged ?? reportedCredits(answer) ?? ESTIMATED_CREDITS[engine]
        return { response: answer, costUsd: credits * CLORO_USD_PER_CREDIT }
      })
      const parsed = parseAnswer(paid.data)
      if (parsed === null) throw new ProviderError({ code: 'invalid_response', provider: 'cloro' })
      const capturedAt = new Date(deps.clock()).toISOString()
      return { ...paid, data: { engine, prompt, ...parsed, capturedAt, source: 'cloro' } }
    },
  }
}

/** The answer, and the credits Cloro charged for it (its X-Credits-Charged header). */
async function send(
  key: string,
  path: string,
  body: object,
): Promise<{ answer: JsonObject; charged: number | null }> {
  let response: Response
  try {
    response = await fetch(CLORO_BASE_URL + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new ProviderError({ code: 'unavailable', provider: 'cloro', status: null })
  }
  if (!response.ok) throw new ProviderError(httpFailure(response))
  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw new ProviderError({ code: 'invalid_response', provider: 'cloro' })
  }
  const answer = object(json)
  // A completed answer with no text is a failure; one with text and no sources is still an answer.
  if (answer === null || parseAnswer(answer) === null) {
    throw new ProviderError({ code: 'invalid_response', provider: 'cloro' })
  }
  const header = Number(response.headers.get('X-Credits-Charged'))
  return { answer, charged: Number.isFinite(header) && header > 0 ? header : null }
}

function httpFailure(response: Response): ProviderFailure {
  const { status } = response
  const provider = 'cloro'
  if (status === 401 || status === 403) return { code: 'auth_failed', provider }
  if (status === 402) return { code: 'no_funds', provider }
  if (status === 429) {
    const wait = Number(response.headers.get('Retry-After'))
    return { code: 'rate_limited', provider, retryAfterS: wait > 0 ? wait : DEFAULT_RETRY_S }
  }
  if (status >= 400 && status < 500) return { code: 'refused', provider, status }
  return { code: 'unavailable', provider, status }
}

/** The answer object: `result` on the sync API, `response` on the async task WorkPods read. */
function answerNode(body: unknown): JsonObject | null {
  const root = object(body)
  return object(root?.['result']) ?? object(root?.['response'])
}

function reportedCredits(body: unknown): number | null {
  const root = object(body)
  return number(object(root?.['credits'])?.['creditsCharged']) ?? number(root?.['creditsCharged'])
}

/**
 * The text (markdown preferred) and one citation per distinct URL: the inline citation pills in
 * order, then the sources consulted without one. Null when the answer has no text.
 */
function parseAnswer(body: unknown): Pick<AiAnswer, 'text' | 'citations'> | null {
  const node = answerNode(body)
  const answerText = text(node?.['markdown']) ?? text(node?.['text'])
  if (node === null || answerText === null) return null
  const byUrl = new Map<string, { url: string; title?: string }>()
  for (const list of [node['citationPills'], node['sources']]) {
    for (const element of array(list)) {
      const row = object(element)
      const url = (text(row?.['url']) ?? text(row?.['link']))?.trim()
      if (url === undefined || byUrl.has(url)) continue
      const title = text(row?.['label']) ?? text(row?.['title'])
      byUrl.set(url, title === null ? { url } : { url, title })
    }
  }
  return { text: answerText, citations: [...byUrl.values()] }
}
