// What a document's own head declares (MetaTags.kt, LinkTags.kt). Search engines honour robots
// meta and canonicals only in the head, so a widget's markup in the body does not speak for the
// page.
import type { HreflangAlternate } from '../model'
import { absolute, collapse } from './dom'

export interface HeadFacts {
  /** As a visitor sees it: null when absent, blank, or a script's unset "undefined" or "null". */
  readonly title: string | null
  readonly titleElement: Element | null
  readonly description: string | null
  /** meta robots and googlebot tokens, lower-cased. */
  readonly robots: readonly string[]
  /** Absolute; null when the head declares none. */
  readonly canonical: string | null
  readonly hreflang: readonly HreflangAlternate[]
  /** Where a meta refresh sends the visitor; null when none does. */
  readonly refreshTo: string | null
}

const UNSET_TITLES = new Set(['undefined', 'null'])

export function headFacts(doc: Document, base: string): HeadFacts {
  // An empty answer parses to a document with no root, whose head some parsers cannot read.
  const head = doc.documentElement === null ? null : (doc.head ?? doc.documentElement)
  const metas = Array.from(head?.querySelectorAll('meta') ?? [])
  const links = Array.from(head?.querySelectorAll('link[rel][href]') ?? [])
  const titleElement = pageTitle(doc)
  const title = titleElement === null ? metaContent(metas, 'og:title') : titleText(titleElement)
  const shown = title !== null && !UNSET_TITLES.has(title.toLowerCase()) ? title : null
  return {
    title: shown,
    titleElement,
    description: metaContent(metas, 'description'),
    robots: metas
      .filter((meta) => ['robots', 'googlebot'].includes(nameOf(meta)))
      .flatMap((meta) => (meta.getAttribute('content') ?? '').split(/[,;]/))
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token !== ''),
    canonical: firstHref(links, base, (rel) => rel.includes('canonical')),
    hreflang: alternates(links, base),
    refreshTo: refreshTarget(doc, base),
  }
}

/** Inline SVG icons carry their own `<title>`; it is never the page's. */
function pageTitle(doc: Document): Element | null {
  const titles = Array.from(doc.querySelectorAll('title'))
  return titles.find((element) => element.closest('svg') === null) ?? null
}

function titleText(element: Element): string | null {
  const text = collapse(element.textContent ?? '')
  return text === '' ? null : text
}

function nameOf(meta: Element): string {
  return (meta.getAttribute('name') ?? meta.getAttribute('property') ?? '').trim().toLowerCase()
}

function metaContent(metas: readonly Element[], name: string): string | null {
  for (const meta of metas) {
    const content = (meta.getAttribute('content') ?? '').trim()
    if (nameOf(meta) === name && content !== '') return content
  }
  return null
}

function relOf(link: Element): string[] {
  return (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/)
}

function firstHref(
  links: readonly Element[],
  base: string,
  wanted: (rel: string[]) => boolean,
): string | null {
  for (const link of links) {
    const href = (link.getAttribute('href') ?? '').trim()
    if (href !== '' && wanted(relOf(link))) return absolute(href, base)
  }
  return null
}

function alternates(links: readonly Element[], base: string): HreflangAlternate[] {
  return links.flatMap((link) => {
    const lang = (link.getAttribute('hreflang') ?? '').trim()
    const url = absolute(link.getAttribute('href') ?? '', base)
    return relOf(link).includes('alternate') && lang !== '' && url !== null
      ? [{ lang: lang.toLowerCase(), url }]
      : []
  })
}

const REFRESH_URL = /^\s*\d*(?:\.\d+)?\s*[;,]\s*(?:url\s*=\s*)?['"]?([^'"]+)/i

/**
 * A meta refresh that moves the visitor, wherever it sits: browsers act on it in the body too, and
 * one inside `<noscript>` moves every crawler that runs no JavaScript.
 */
function refreshTarget(doc: Document, base: string): string | null {
  for (const meta of Array.from(doc.querySelectorAll('meta[http-equiv]'))) {
    if ((meta.getAttribute('http-equiv') ?? '').trim().toLowerCase() !== 'refresh') continue
    const target = REFRESH_URL.exec(meta.getAttribute('content') ?? '')?.[1]?.trim()
    if (target) return absolute(target, base)
  }
  return null
}
