import { anyOf, blockText, citedLinks, firstOf, lastOf } from './extract'
import type { EngineAdapter } from './types'

// Gemini renders turns as Angular custom elements, which are stabler than its class names.
const ANSWER = ['model-response', '[data-response-index]', '.model-response-text']
const BODY = ['message-content', '.markdown', '[class*="markdown"]']
const QUESTION = ['user-query', '.query-text']
const SOURCES = ['sources-list', '[data-test-id="sources-list"]', 'source-footnote']
const BUSY = [
  'model-response [aria-busy="true"]',
  'button[aria-label="Stop response"]',
  'button[aria-label*="Stop"]',
]
const INPUT = [
  'rich-textarea [contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'textarea',
]

export const gemini: EngineAdapter = {
  id: 'gemini',
  matches: (url) => url.hostname === 'gemini.google.com',
  read(doc, pageUrl) {
    const turn = lastOf(doc, ANSWER)
    if (turn === null) return null
    const body = firstOf(turn, BODY) ?? turn
    const sources = firstOf(turn, SOURCES)
    const question = lastOf(doc, QUESTION)
    return {
      engine: 'gemini',
      pageUrl,
      prompt: question === null ? null : blockText(question),
      text: blockText(body),
      citations: citedLinks(sources === null ? [body] : [body, sources], pageUrl, [
        'gemini.google.com',
        'support.google.com',
        'policies.google.com',
      ]),
      streaming: anyOf(doc, BUSY),
    }
  },
  promptInput: (doc) => firstOf(doc, INPUT) as HTMLElement | null,
}
