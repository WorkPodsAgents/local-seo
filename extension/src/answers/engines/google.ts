import { anyOf, blockText, citedLinks, firstOf, lastOf, sectionHeadedBy } from './extract'
import type { EngineAdapter, ReadAnswer } from './types'

// Google's class names are generated and change weekly. Its visible headings ("AI Overview",
// "AI Mode") and data attributes change least, so they go first.

const GOOGLE_HOST = /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/
/** The results-page parameter that opens AI Mode. */
const AI_MODE_UDM = '50'

const MODE_TURN = ['[data-subtree="aimc"]', '[data-container-id="main-col"] [data-hveid]']
const BUSY = ['[aria-busy="true"]', 'button[aria-label*="Stop" i]']
const MODE_INPUT = [
  'textarea[aria-label*="Ask" i]',
  'textarea[name="q"]',
  'input[name="q"]',
  'textarea',
]
const OWN = ['google.com', 'gstatic.com', 'googleusercontent.com', 'support.google.com']

function isSearch(url: URL): boolean {
  return GOOGLE_HOST.test(url.hostname) && url.pathname === '/search'
}

function answer(engine: ReadAnswer['engine'], section: Element, pageUrl: string): ReadAnswer {
  const query = new URL(pageUrl).searchParams.get('q')
  return {
    engine,
    pageUrl,
    prompt: query,
    text: blockText(section),
    // The country domain the page is on is Google's own too, such as google.co.uk.
    citations: citedLinks([section], pageUrl, [...OWN, new URL(pageUrl).hostname]),
    streaming: section.getAttribute('aria-busy') === 'true' || anyOf(section, BUSY),
  }
}

export const googleAiMode: EngineAdapter = {
  id: 'ai_mode',
  matches: (url) => isSearch(url) && url.searchParams.get('udm') === AI_MODE_UDM,
  read(doc, pageUrl) {
    const section =
      lastOf(doc, MODE_TURN) ??
      sectionHeadedBy(doc, /^AI Mode$/i) ??
      firstOf(doc, ['[role="main"]'])
    return section === null ? null : answer('ai_mode', section, pageUrl)
  },
  promptInput: (doc) => firstOf(doc, MODE_INPUT) as HTMLElement | null,
}
