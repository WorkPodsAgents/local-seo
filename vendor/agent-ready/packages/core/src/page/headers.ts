// What a response's headers declare (ResponseHeaders.kt): X-Robots-Tag directives for Google and
// the Link header's canonical and hreflang alternates, which count like their HTML forms.
import type { HreflangAlternate } from '../model'
import { absolute } from './dom'

/** `unavailable_after: <date>` and the snippet limits are directives, not crawler names. */
const NON_AGENT = new Set([
  'unavailable_after',
  'max-snippet',
  'max-image-preview',
  'max-video-preview',
])

/**
 * Directives for Google: unprefixed ones and those after `googlebot:`, which applies until
 * another crawler is named; `bingbot: noindex` does not apply.
 */
export function xRobots(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') return []
  let agent: string | null = null
  const found = new Set<string>()
  for (const raw of value.split(',')) {
    let token = raw.trim().toLowerCase()
    const colon = token.indexOf(':')
    if (colon > 0 && !NON_AGENT.has(token.slice(0, colon).trim())) {
      agent = token.slice(0, colon).trim()
      token = token.slice(colon + 1).trim()
    }
    if (token !== '' && (agent === null || agent === 'googlebot')) found.add(token)
  }
  return [...found]
}

export interface LinkHeader {
  readonly canonical: string | null
  readonly alternates: readonly HreflangAlternate[]
}

const LINK_PART = /<([^>]*)>([^,<]*)/g

export function linkHeader(value: string | undefined, base: string): LinkHeader {
  let canonical: string | null = null
  const alternates: HreflangAlternate[] = []
  for (const part of (value ?? '').matchAll(LINK_PART)) {
    const params = linkParams(part[2] ?? '')
    const rel = (params.get('rel') ?? '').toLowerCase().split(/\s+/)
    const href = absolute(part[1] ?? '', base)
    if (href === null) continue
    if (rel.includes('canonical') && canonical === null) canonical = href
    const lang = params.get('hreflang')
    if (rel.includes('alternate') && lang) alternates.push({ lang: lang.toLowerCase(), url: href })
  }
  return { canonical, alternates }
}

function linkParams(text: string): Map<string, string> {
  const params = new Map<string, string>()
  for (const piece of text.split(';')) {
    const at = piece.indexOf('=')
    if (at < 0) continue
    const value = piece
      .slice(at + 1)
      .trim()
      .replace(/^"|"$/g, '')
      .trim()
    params.set(piece.slice(0, at).trim().toLowerCase(), value)
  }
  return params
}
