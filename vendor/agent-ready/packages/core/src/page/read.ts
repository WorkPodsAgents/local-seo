// One read of a snapshot that every check and the agent view share, so a page is parsed for its
// facts once.
import type { HreflangAlternate, PageLink, PageSnapshot } from '../model'
import {
  absolute,
  baseOf,
  collapse,
  comparable,
  headings,
  siteHost,
  visibleText,
  wordCount,
} from './dom'
import type { Heading } from './dom'
import { headFacts } from './head'
import type { HeadFacts } from './head'
import { linkHeader, xRobots } from './headers'
import { structuredData } from './schema'
import type { StructuredData } from './schema'

/** What one Document holds: the raw answer's or the rendered page's. */
export interface DocumentRead {
  readonly doc: Document
  readonly base: string
  readonly head: HeadFacts
  readonly text: string
  readonly words: number
  readonly headings: readonly Heading[]
  readonly h1s: readonly string[]
  readonly schema: StructuredData
  readonly links: readonly PageLink[]
  /** The anchor each link came from, by index, for evidence selectors. */
  readonly anchors: readonly Element[]
}

export interface PageRead {
  readonly snapshot: PageSnapshot
  readonly raw: DocumentRead
  readonly rendered: DocumentRead | null
  /** The rendered page where there is one, else the raw answer: what a visitor sees. */
  readonly shown: DocumentRead
  /** The page answered 2xx: only then are its content checks judged. */
  readonly ok: boolean
  /** The HTML canonical, else the Link header's. */
  readonly canonical: string | null
  readonly noindex: boolean
  readonly noindexSource: string | null
  readonly hreflang: readonly HreflangAlternate[]
}

const NOINDEX = new Set(['noindex', 'none'])

export function readPage(snapshot: PageSnapshot): PageRead {
  const raw = readDocument(snapshot.raw, snapshot.url)
  const rendered = snapshot.rendered === null ? null : readDocument(snapshot.rendered, snapshot.url)
  const shown = rendered ?? raw
  const header = linkHeader(snapshot.headers['link'], snapshot.url)
  const noindexSource = indexingBlock(snapshot, raw, rendered)
  const hreflang = new Map<string, HreflangAlternate>()
  for (const alternate of [...shown.head.hreflang, ...header.alternates]) {
    hreflang.set(`${alternate.lang} ${alternate.url}`, alternate)
  }
  return {
    snapshot,
    raw,
    rendered,
    shown,
    ok: snapshot.status >= 200 && snapshot.status < 300,
    canonical: shown.head.canonical ?? header.canonical,
    noindex: noindexSource !== null,
    noindexSource,
    hreflang: [...hreflang.values()],
  }
}

/**
 * Any source showing noindex fires, as WorkPods reads it: the raw answer's robots meta (what a
 * crawler sees before it renders), the rendered page's, or the X-Robots-Tag header.
 */
function indexingBlock(
  snapshot: PageSnapshot,
  raw: DocumentRead,
  rendered: DocumentRead | null,
): string | null {
  const blocks = (tokens: readonly string[]) => tokens.some((token) => NOINDEX.has(token))
  if (blocks(xRobots(snapshot.headers['x-robots-tag']))) return 'X-Robots-Tag header'
  if (blocks(raw.head.robots)) return 'robots meta tag'
  if (rendered !== null && blocks(rendered.head.robots)) return 'robots meta tag added by script'
  return null
}

function readDocument(doc: Document, pageUrl: string): DocumentRead {
  const base = baseOf(doc, pageUrl)
  const text = visibleText(doc)
  const found = headings(doc)
  const anchors = anchorLinks(doc, base, pageUrl)
  return {
    doc,
    base,
    head: headFacts(doc, base),
    text,
    words: wordCount(text),
    headings: found,
    h1s: found.filter((heading) => heading.level === 1).map((heading) => heading.text),
    schema: structuredData(doc),
    links: anchors.map((anchor) => anchor.link),
    anchors: anchors.map((anchor) => anchor.element),
  }
}

const SKIPPED = /^(#|javascript:|mailto:|tel:)/i

/** Anchor links, absolute without their fragment; internal on the page's host or a subdomain. */
function anchorLinks(
  doc: Document,
  base: string,
  pageUrl: string,
): { link: PageLink; element: Element }[] {
  const site = siteHost(pageUrl)
  return Array.from(doc.querySelectorAll('a[href]')).flatMap((anchor) => {
    const href = (anchor.getAttribute('href') ?? '').trim()
    const url = href === '' || SKIPPED.test(href) ? null : absolute(href, base)
    if (url === null) return []
    const host = siteHost(url)
    const link = {
      url: url.replace(/#.*$/, ''),
      rel: (anchor.getAttribute('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean),
      text: collapse(anchor.textContent ?? ''),
      internal: host === null || (site !== null && (host === site || host.endsWith(`.${site}`))),
    }
    return [{ link, element: anchor }]
  })
}

/** Whether `canonical` names the page itself, as WorkPods compares URLs. */
export function namesSelf(canonical: string, pageUrl: string): boolean {
  return comparable(canonical) === comparable(pageUrl)
}
