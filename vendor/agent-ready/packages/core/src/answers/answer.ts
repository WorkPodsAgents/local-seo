// An AI assistant's answer to one prompt, however it was captured: read from the user's own tab
// (reader), filled in by the extension and sent by the user (assist), or asked through Cloro.

export type AnswerEngine =
  'chatgpt' | 'gemini' | 'claude' | 'perplexity' | 'ai_mode' | 'ai_overview'

export type AnswerSource = 'assist' | 'reader' | 'cloro'

export interface Citation {
  readonly url: string
  readonly title?: string
}

export interface AiAnswer {
  readonly engine: AnswerEngine
  readonly prompt: string
  readonly text: string
  /** Each distinct URL once, in the order the answer gave them. Empty for an answer from memory. */
  readonly citations: readonly Citation[]
  /** ISO 8601. */
  readonly capturedAt: string
  readonly source: AnswerSource
}
