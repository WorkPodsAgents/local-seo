// The messages the service worker sends the answers content script in an assistant's tab. They
// never carry a secret: the page only ever gets the prompt text to fill in.
import type { ReadAnswer } from './engines'

export interface AnswerMessages {
  /** Fills the prompt box. `before` is the answer already on the page, to wait past it. */
  'answers:fill': {
    request: { prompt: string }
    response: { filled: boolean; before: string | null }
  }
  /** Waits for the user to send the prompt and the assistant to finish answering. */
  'answers:await': {
    request: { before: string | null; timeoutMs: number }
    response: ReadAnswer | null
  }
}

export type AnswerMessageType = keyof AnswerMessages

export function isAnswerMessage<T extends AnswerMessageType>(
  message: unknown,
  type: T,
): message is { type: T; payload: AnswerMessages[T]['request'] } {
  return (
    typeof message === 'object' && message !== null && 'type' in message && message.type === type
  )
}
