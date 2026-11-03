// Reading a parsed Document the way WorkPods' extractor reads HTML (HtmlText.kt): what a visitor
// sees, its words and headings, and URLs resolved against the page.

/** Elements a visitor never sees: their text is no content and their headings no headings. */
const UNSHOWN = new Set(['script', 'style', 'noscript', 'svg', 'head', 'template'])

const ELEMENT = 1
const TEXT = 3

/** Whether neither `element` nor an ancestor is an element a visitor never sees. */
export function isShown(element: Element): boolean {
  for (let at: Element | null = element; at !== null; at = at.parentElement) {
    if (UNSHOWN.has(at.localName)) return false
  }
  return true
}

/** The text a visitor sees under `root`, whitespace collapsed; every element breaks a word. */
export function shownText(root: Node): string {
  const parts: string[] = []
  collect(root, parts)
  return collapse(parts.join(' '))
}

function collect(node: Node, parts: string[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === TEXT) parts.push(child.textContent ?? '')
    else if (child.nodeType === ELEMENT && !UNSHOWN.has((child as Element).localName)) {
      collect(child, parts)
    }
  }
}

export function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** The document's visible text: what the word count counts and the text hash hashes. */
export function visibleText(doc: Document): string {
  return shownText(doc)
}

export function wordCount(text: string): number {
  return text === '' ? 0 : text.split(' ').length
}

export interface Heading {
  readonly level: number
  readonly text: string
}

/** Headings a visitor sees, in order; empty ones are left out (Headings.kt). */
export function headings(doc: Document): Heading[] {
  return Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .filter(isShown)
    .map((element) => ({ level: Number(element.localName.slice(1)), text: shownText(element) }))
    .filter((heading) => heading.text !== '')
}

/** The URL relative links resolve against: the page's `<base href>`, else the page itself. */
export function baseOf(doc: Document, pageUrl: string): string {
  const href = doc.querySelector('base[href]')?.getAttribute('href')
  return (href ? absolute(href, pageUrl) : null) ?? pageUrl
}

/** `href` resolved against `base`; null when it is no URL. */
export function absolute(href: string, base: string): string | null {
  try {
    return new URL(href.trim(), base).href
  } catch {
    return null
  }
}

/** For comparing URLs as WorkPods does: no scheme, no www, no trailing slash, any case. */
export function comparable(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

/** A host without its www, for telling internal links from external ones. */
export function siteHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}
