// What an answer reader takes from an AI engine's page. Brands are not picked out here: the
// scorer finds them in `text`, so every engine is judged by the same rules.

import type { AiEngine } from '@local-seo/core/bridge'

/** The assistants local_ai_visibility asks; ported from Agent Ready's readers. */
export type EngineId = AiEngine

export const ENGINE_LABEL: Readonly<Record<EngineId, string>> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  ai_mode: 'Google AI Mode',
}

/** One source an answer links to. */
export interface CitedSource {
  /** Absolute, with engine tracking parameters and redirect wrappers removed. */
  readonly url: string
  /** The link text or label; null when the link showed none. */
  readonly title: string | null
}

/** The latest answer on the page, as the user's own session shows it. */
export interface ReadAnswer {
  readonly engine: EngineId
  /** The page the answer was read from. */
  readonly pageUrl: string
  /** The prompt the answer replies to; null when the page did not show it. */
  readonly prompt: string | null
  /** The answer's visible text, block elements separated by newlines. */
  readonly text: string
  readonly citations: readonly CitedSource[]
  /** True while the engine is still writing the answer. */
  readonly streaming: boolean
}

/**
 * One engine's page knowledge. Each tries semantic and ARIA hooks first and class names last, so
 * a markup change on one engine breaks only the hook that changed.
 */
export interface EngineAdapter {
  readonly id: EngineId
  /** True when this adapter reads the page at `url`. */
  matches(url: URL): boolean
  /** The latest answer, or null when the page shows none. */
  read(doc: Document, pageUrl: string): ReadAnswer | null
  /** The box the user types a prompt into, or null when it cannot be found. */
  promptInput(doc: Document): HTMLElement | null
}
