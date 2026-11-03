import { anyOf, blockText, citedLinks, firstOf, lastOf } from './extract'
import type { EngineAdapter } from './types'

// ChatGPT marks each turn with its author's role; the markdown body and the sources list sit
// inside the assistant turn. Class names are the last resort.
const ANSWER = [
  '[data-message-author-role="assistant"]',
  'article[data-turn="assistant"]',
  '.agent-turn',
]
const BODY = ['.markdown', '[class*="markdown"]']
const QUESTION = ['[data-message-author-role="user"]', 'article[data-turn="user"]']
const SOURCES = ['[data-testid="sources-list"]', 'section[aria-label="Sources"]']
const STOP = [
  'button[data-testid="stop-button"]',
  'button[aria-label="Stop streaming"]',
  'button[aria-label="Stop generating"]',
]
const INPUT = ['#prompt-textarea', 'div[contenteditable="true"][role="textbox"]', 'textarea']

export const chatgpt: EngineAdapter = {
  id: 'chatgpt',
  matches: (url) => url.hostname === 'chatgpt.com' || url.hostname === 'chat.openai.com',
  read(doc, pageUrl) {
    const turn = lastOf(doc, ANSWER)
    if (turn === null) return null
    const body = firstOf(turn, BODY) ?? turn
    const sources = firstOf(doc, SOURCES)
    const question = lastOf(doc, QUESTION)
    return {
      engine: 'chatgpt',
      pageUrl,
      prompt: question === null ? null : blockText(question),
      text: blockText(body),
      citations: citedLinks(sources === null ? [turn] : [turn, sources], pageUrl, [
        'chatgpt.com',
        'openai.com',
      ]),
      streaming: anyOf(doc, STOP) || turn.querySelector('.result-streaming') !== null,
    }
  },
  promptInput: (doc) => firstOf(doc, INPUT) as HTMLElement | null,
}
