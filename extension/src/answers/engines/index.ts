import { chatgpt } from './chatgpt'
import { gemini } from './gemini'
import { googleAiMode } from './google'
import { perplexity } from './perplexity'
import type { EngineAdapter, EngineId } from './types'

export type { CitedSource, EngineAdapter, EngineId, ReadAnswer } from './types'
export { ENGINE_LABEL } from './types'

export const ENGINES: Readonly<Record<EngineId, EngineAdapter>> = {
  chatgpt,
  gemini,
  perplexity,
  ai_mode: googleAiMode,
}

/**
 * Where Assist mode opens each assistant: its empty prompt page. The prompt is never put in the
 * address, since loading such an address would send it without the user pressing Enter.
 */
export const ENGINE_HOME: Readonly<Record<EngineId, string>> = {
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/app',
  perplexity: 'https://www.perplexity.ai/',
  ai_mode: 'https://www.google.com/search?udm=50',
}

/** The adapter that reads `url`, or null when no supported assistant serves it. */
export function engineFor(url: string): EngineAdapter | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  return Object.values(ENGINES).find((engine) => engine.matches(parsed)) ?? null
}
