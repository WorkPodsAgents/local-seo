// The DOM reading every engine adapter shares. It works on any Document (the live page or a
// parsed fixture), so it uses textContent and attributes only, never layout.
import type { CitedSource } from './types'

/** The first element any selector finds, trying the selectors in order of trust. */
export function firstOf(root: ParentNode, selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    const found = root.querySelector(selector)
    if (found !== null) return found
  }
  return null
}

/** The last element the first productive selector finds: the newest turn of a conversation. */
export function lastOf(root: ParentNode, selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    const found = root.querySelectorAll(selector)
    const last = found[found.length - 1]
    if (last !== undefined) return last
  }
  return null
}

export function anyOf(root: ParentNode, selectors: readonly string[]): boolean {
  return firstOf(root, selectors) !== null
}

const BLOCK = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BR',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TR',
  'UL',
])

// Copy and feedback buttons, icons and screen-reader-hidden chrome are not part of the answer.
const SKIP = new Set(['BUTTON', 'SCRIPT', 'STYLE', 'svg', 'TEMPLATE', 'NOSCRIPT'])

/** The visible text of an answer, with block elements on their own lines. */
export function blockText(root: Element): string {
  const parts: string[] = []
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      // A line break in the source is only whitespace; lines come from block elements.
      parts.push((node.textContent ?? '').replace(/\s+/g, ' '))
      return
    }
    if (node.nodeType !== 1) return
    const el = node as Element
    if (SKIP.has(el.tagName) || el.getAttribute('aria-hidden') === 'true') return
    if (el.hasAttribute('hidden')) return
    const block = BLOCK.has(el.tagName)
    if (block) parts.push('\n')
    for (const child of Array.from(el.childNodes)) walk(child)
    if (block) parts.push('\n')
  }
  walk(root)
  return parts
    .join('')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

// Engines tag outbound links so the target site can see the referral; the source is the same.
const TRACKING = /^(utm_[a-z]+|srsltid|ref|ref_src)$/

/** An absolute http(s) URL without redirect wrappers or tracking, or null for anything else. */
export function cleanUrl(href: string, base: string): string | null {
  let url: URL
  try {
    url = new URL(href, base)
  } catch {
    return null
  }
  const wrapped =
    url.pathname === '/url' ? (url.searchParams.get('q') ?? url.searchParams.get('url')) : null
  if (wrapped !== null) return cleanUrl(wrapped, base)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  for (const key of Array.from(url.searchParams.keys())) {
    if (TRACKING.test(key)) url.searchParams.delete(key)
  }
  url.hash = ''
  return url.toString()
}

/**
 * The sources linked from `roots`, in page order, once each. Links back to the engine itself
 * (`ownHosts`, matched with their subdomains) are navigation, not sources.
 */
export function citedLinks(
  roots: readonly Element[],
  base: string,
  ownHosts: readonly string[],
): CitedSource[] {
  const seen = new Map<string, CitedSource>()
  for (const root of roots) {
    for (const link of Array.from(root.querySelectorAll('a[href]'))) {
      const url = cleanUrl(link.getAttribute('href') ?? '', base)
      if (url === null || seen.has(url)) continue
      const host = new URL(url).hostname
      if (ownHosts.some((own) => host === own || host.endsWith(`.${own}`))) continue
      seen.set(url, { url, title: linkTitle(link) })
    }
  }
  return [...seen.values()]
}

function linkTitle(link: Element): string | null {
  const label = link.getAttribute('aria-label') ?? link.getAttribute('title')
  const text = (label ?? link.textContent ?? '').replace(/\s+/g, ' ').trim()
  return text.length > 0 ? text : null
}

/** The element whose own heading text is `label`, for engines that name a section in words. */
export function sectionHeadedBy(root: ParentNode, label: RegExp): Element | null {
  const headings = root.querySelectorAll('h1, h2, h3, h4, [role="heading"]')
  for (const heading of Array.from(headings)) {
    if (!label.test((heading.textContent ?? '').trim())) continue
    // The answer is the heading's nearest ancestor that holds more than the heading itself.
    let section = heading.parentElement
    while (section !== null && (section.textContent ?? '').trim() === heading.textContent?.trim()) {
      section = section.parentElement
    }
    if (section !== null) return section
  }
  return null
}
