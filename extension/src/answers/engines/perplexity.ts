import { anyOf, blockText, citedLinks, firstOf, lastOf } from './extract'
import type { EngineAdapter } from './types'

// Perplexity numbers its markdown blocks by id; the sources strip sits beside the answer.
const ANSWER = ['[id^="markdown-content-"]', '[data-testid="answer"]', '.prose']
const QUESTION = ['[data-testid="query"]', 'h1']
const SOURCES = ['[data-testid="sources"]', '[aria-label="Sources"]']
const STOP = ['button[aria-label="Stop"]', 'button[data-testid="stop-generating-response-button"]']
const INPUT = ['#ask-input', 'div[contenteditable="true"][role="textbox"]', 'textarea']

export const perplexity: EngineAdapter = {
  id: 'perplexity',
  matches: (url) => url.hostname === 'www.perplexity.ai' || url.hostname === 'perplexity.ai',
  read(doc, pageUrl) {
    const body = lastOf(doc, ANSWER)
    if (body === null) return null
    const sources = lastOf(doc, SOURCES)
    const question = lastOf(doc, QUESTION)
    return {
      engine: 'perplexity',
      pageUrl,
      prompt: question === null ? null : blockText(question),
      text: blockText(body),
      citations: citedLinks(sources === null ? [body] : [body, sources], pageUrl, [
        'perplexity.ai',
      ]),
      streaming: anyOf(doc, STOP),
    }
  },
  promptInput: (doc) => firstOf(doc, INPUT) as HTMLElement | null,
}
