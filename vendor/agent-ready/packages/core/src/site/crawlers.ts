// Ported from WorkPods AiCrawlers.kt. Tokens are matched as robots.txt product tokens, never as
// substrings, and each was checked against its operator's crawler page.
import type { AiCrawler } from '../model'

/** The AI crawlers WorkPods tracks, in the server table's order. */
export const AI_CRAWLERS: readonly AiCrawler[] = [
  { token: 'GPTBot', operator: 'OpenAI', role: 'training' },
  { token: 'OAI-SearchBot', operator: 'OpenAI', role: 'search_index' },
  { token: 'ChatGPT-User', operator: 'OpenAI', role: 'user_fetch' },
  { token: 'ClaudeBot', operator: 'Anthropic', role: 'training' },
  { token: 'Claude-SearchBot', operator: 'Anthropic', role: 'search_index' },
  { token: 'Claude-User', operator: 'Anthropic', role: 'user_fetch' },
  { token: 'PerplexityBot', operator: 'Perplexity', role: 'search_index' },
  { token: 'Perplexity-User', operator: 'Perplexity', role: 'user_fetch' },
  { token: 'Google-Extended', operator: 'Google', role: 'training' },
  { token: 'CCBot', operator: 'Common Crawl', role: 'training' },
  { token: 'Applebot-Extended', operator: 'Apple', role: 'training' },
  { token: 'meta-externalagent', operator: 'Meta', role: 'training' },
  // ByteDance publishes no crawler page; this is the product token its crawler sends.
  { token: 'Bytespider', operator: 'ByteDance', role: 'training' },
  // Amazon says content Amazonbot reads may train models.
  { token: 'Amazonbot', operator: 'Amazon', role: 'training' },
  { token: 'DuckAssistBot', operator: 'DuckDuckGo', role: 'user_fetch' },
  { token: 'Google-Agent', operator: 'Google', role: 'user_fetch' },
  { token: 'MistralAI-User', operator: 'Mistral', role: 'user_fetch' },
]
