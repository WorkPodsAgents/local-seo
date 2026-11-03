// The cross-page checks, ported from WorkPods FlagRules (status, indexing, links), Duplicates
// and SiteRoot (CrossPageFacts.kt), HreflangChecks.kt and GraphChecks.kt. Each judges one page:
// it fires with evidence, is clear, or is null when nothing it needs was observed.
import type { CheckGroup, Evidence, PageFacts } from '../model'
import {
  canonicalElsewhere,
  isContent,
  isIndexable,
  normalizeUrl,
  type SiteGraph,
} from './site-graph'

export type Verdict =
  { readonly fires: true; readonly evidence: readonly Evidence[] } | false | null

export interface CrossPageCheck {
  readonly id: string
  readonly group: CheckGroup
  /** What a firing page does, after "This page", as in "links to a URL that redirects". */
  readonly one: string
  /** The same for several pages, after "5 of 120 pages". */
  readonly many: string
  judge(page: number): Verdict
}

/** A page deeper than this many clicks from the start page is a deep page (LinkGraphRun). */
export const DEEP_DEPTH = 3
const MAX_EVIDENCE = 10

export function crossPageChecks(graph: SiteGraph): CrossPageCheck[] {
  const { pages } = graph
  const titles = shared(pages, (p) => p.title)
  const descriptions = shared(pages, (p) => p.metaDescription)
  const contents = shared(pages, (p) => (p.wordCount > 0 ? p.textHash : null))
  const page = (i: number): PageFacts => pages[i] as PageFacts
  return [
    {
      id: 'duplicate_title',
      group: 'title_meta',
      one: 'shares its title with another indexable page',
      many: 'share a title with another indexable page',
      judge: (i) => duplicate(page(i), titles, (p) => p.title),
    },
    {
      id: 'duplicate_meta_description',
      group: 'title_meta',
      one: 'shares its meta description with another indexable page',
      many: 'share a meta description with another indexable page',
      judge: (i) => duplicate(page(i), descriptions, (p) => p.metaDescription),
    },
    {
      id: 'duplicate_content',
      group: 'headings_content',
      one: 'has the same visible text as another indexable page',
      many: 'have the same visible text as another indexable page',
      judge: (i) => duplicate(page(i), contents, (p) => (p.wordCount > 0 ? p.textHash : null)),
    },
    {
      id: 'orphan_page',
      group: 'links',
      one: 'has no internal link from another crawled page',
      many: 'have no internal link from another crawled page',
      judge: (i) => orphan(graph, i),
    },
    {
      id: 'deep_page',
      group: 'links',
      one: `is more than ${DEEP_DEPTH} clicks from the start page`,
      many: `are more than ${DEEP_DEPTH} clicks from the start page`,
      judge: (i) => deep(graph, i),
    },
    {
      id: 'broken_internal_link',
      group: 'links',
      one: 'links to a page that answered 400 or above',
      many: 'link to a page that answered 400 or above',
      judge: (i) => linkTargets(graph, i, (to) => brokenTarget(graph, to)),
    },
    {
      id: 'internal_link_to_redirect',
      group: 'links',
      one: 'links to a URL that redirects',
      many: 'link to a URL that redirects',
      judge: (i) => linkTargets(graph, i, (to) => redirectTarget(graph, to)),
    },
    {
      id: 'sitemap_url_error',
      group: 'indexing',
      one: 'is listed in a sitemap but answered 400 or above',
      many: 'are listed in a sitemap but answered 400 or above',
      judge: (i) => sitemapError(graph, i),
    },
    {
      id: 'sitemap_non_indexable',
      group: 'indexing',
      one: 'is listed in a sitemap but is noindex or canonicalised elsewhere',
      many: 'are listed in a sitemap but are noindex or canonicalised elsewhere',
      judge: (i) => sitemapNonIndexable(graph, i),
    },
    {
      id: 'missing_from_sitemap',
      group: 'indexing',
      one: 'is indexable but listed in no sitemap',
      many: 'are indexable but listed in no sitemap',
      judge: (i) => missingFromSitemap(graph, i),
    },
    {
      id: 'hreflang_missing_return',
      group: 'international',
      one: 'names an hreflang alternate that does not link back',
      many: 'name an hreflang alternate that does not link back',
      judge: (i) => missingReturn(graph, i),
    },
    {
      id: 'hreflang_target_not_200',
      group: 'international',
      one: 'names an hreflang alternate that did not answer 200',
      many: 'name an hreflang alternate that did not answer 200',
      judge: (i) => targetNot200(graph, i),
    },
    {
      id: 'soft_404',
      group: 'indexing',
      one: 'answers 200 but shows the start page',
      many: 'answer 200 but show the start page',
      judge: (i) => soft404(graph, i),
    },
  ]
}

type Key = (page: PageFacts) => string | null

/** The folded key a duplicate check compares, for an indexable page; null when skipped. */
function keyOf(page: PageFacts, key: Key): string | null {
  const value = key(page)?.trim().toLowerCase()
  return isIndexable(page) && value !== undefined && value !== '' ? value : null
}

/** Each key more than one indexable page has, with those pages' URLs. */
function shared(pages: readonly PageFacts[], key: Key): Map<string, string[]> {
  const byKey = new Map<string, string[]>()
  for (const page of pages) {
    const value = keyOf(page, key)
    if (value !== null) byKey.set(value, [...(byKey.get(value) ?? []), page.url])
  }
  for (const [value, urls] of byKey) if (urls.length < 2) byKey.delete(value)
  return byKey
}

function duplicate(page: PageFacts, sharedKeys: Map<string, string[]>, key: Key): Verdict {
  const value = keyOf(page, key)
  if (value === null) return null
  const others = (sharedKeys.get(value) ?? []).filter((url) => url !== page.url)
  if (others.length === 0) return false
  const shown = key(page) ?? ''
  return {
    fires: true,
    evidence: [{ value: shown, note: `Also on ${others.slice(0, 5).join(', ')}` }],
  }
}

/** A 2xx page other than the start page that no crawled page links to; measured on a full crawl. */
function orphan(graph: SiteGraph, i: number): Verdict {
  const page = graph.pages[i]
  if (!graph.crawlComplete || page === undefined || !isContent(page) || i === graph.start) {
    return null
  }
  return (graph.inlinks[i] ?? 0) === 0 ? { fires: true, evidence: [{ url: page.url }] } : false
}

function deep(graph: SiteGraph, i: number): Verdict {
  const depth = graph.depth[i]
  const page = graph.pages[i]
  if (!graph.crawlComplete || depth === null || depth === undefined || page === undefined) {
    return null
  }
  return depth > DEEP_DEPTH
    ? { fires: true, evidence: [{ url: page.url, note: `${depth} clicks` }] }
    : false
}

/**
 * A link-target check: one offending observed target fires it; it is clear only when every
 * target was observed (so a page with no internal links is clear); otherwise unmeasured.
 */
function linkTargets(
  graph: SiteGraph,
  i: number,
  offends: (url: string) => Evidence | null | undefined,
): Verdict {
  const page = graph.pages[i]
  if (page === undefined || !isContent(page)) return null
  const targets = [...new Set(page.links.filter((l) => l.internal).map((l) => l.url))]
  const verdicts = targets.map(offends)
  const found = verdicts.filter((v): v is Evidence => v !== null && v !== undefined)
  if (found.length > 0) return { fires: true, evidence: found.slice(0, MAX_EVIDENCE) }
  return verdicts.includes(undefined) ? null : false
}

/** Evidence when the target answered 400 or above, null when fine, undefined when unobserved. */
function brokenTarget(graph: SiteGraph, url: string): Evidence | null | undefined {
  const landing = graph.landing(url)
  if (landing === undefined) return undefined
  const status = graph.pages[landing.page]?.status ?? 0
  return status >= 400 ? { url, note: `HTTP ${status}` } : null
}

function redirectTarget(graph: SiteGraph, url: string): Evidence | null | undefined {
  const landing = graph.landing(url)
  if (landing === undefined) return undefined
  const to = graph.pages[landing.page]?.url ?? ''
  return landing.redirected ? { url, note: `Redirects to ${to}` } : null
}

function sitemapError(graph: SiteGraph, i: number): Verdict {
  const page = graph.pages[i]
  if (page === undefined || !graph.listed(i)) return null
  return page.status >= 400
    ? { fires: true, evidence: [{ url: page.url, note: `HTTP ${page.status}` }] }
    : false
}

function sitemapNonIndexable(graph: SiteGraph, i: number): Verdict {
  const page = graph.pages[i]
  if (page === undefined || !isContent(page) || !graph.listed(i)) return null
  if (page.noindex) return { fires: true, evidence: [{ url: page.url, note: 'noindex' }] }
  if (canonicalElsewhere(page)) {
    return {
      fires: true,
      evidence: [{ url: page.url, note: `Canonical is ${page.canonical ?? ''}` }],
    }
  }
  return false
}

function missingFromSitemap(graph: SiteGraph, i: number): Verdict {
  const page = graph.pages[i]
  if (page === undefined || !graph.sitemapComplete || !isIndexable(page)) return null
  return graph.listed(i) ? false : { fires: true, evidence: [{ url: page.url }] }
}

/** The crawled pages a page's hreflang alternates lead to. */
function alternatePages(graph: SiteGraph, page: PageFacts): Set<number> {
  const found = new Set<number>()
  for (const alternate of page.hreflang) {
    const landing = graph.landing(alternate.url)
    if (landing !== undefined) found.add(landing.page)
  }
  return found
}

/** An alternate page answering 2xx whose own alternates do not lead back. */
function missingReturn(graph: SiteGraph, i: number): Verdict {
  const page = graph.pages[i]
  if (page === undefined || !isContent(page) || page.hreflang.length === 0) return null
  const peers = [...alternatePages(graph, page)].filter((p) => {
    const peer = graph.pages[p]
    return p !== i && peer !== undefined && isContent(peer)
  })
  if (peers.length === 0) return null
  const missing = peers.filter((p) => !alternatePages(graph, graph.pages[p] as PageFacts).has(i))
  if (missing.length === 0) return false
  const evidence = missing.slice(0, MAX_EVIDENCE).map((p) => ({ url: graph.pages[p]?.url ?? '' }))
  return { fires: true, evidence }
}

/** An alternate whose own fetch did not answer 200 unredirected. */
function targetNot200(graph: SiteGraph, i: number): Verdict {
  const page = graph.pages[i]
  if (page === undefined || !isContent(page)) return null
  const evidence: Evidence[] = []
  let observed = 0
  for (const alternate of page.hreflang) {
    const landing = graph.landing(alternate.url)
    if (landing === undefined) continue
    observed++
    const status = graph.pages[landing.page]?.status ?? 0
    if (landing.redirected) evidence.push({ url: alternate.url, note: 'Redirects' })
    else if (status !== 200) evidence.push({ url: alternate.url, note: `HTTP ${status}` })
  }
  if (observed === 0) return null
  return evidence.length > 0 ? { fires: true, evidence: evidence.slice(0, MAX_EVIDENCE) } : false
}

/**
 * A 200 page that renders the start page: its canonical names it, or its text is the start
 * page's. WorkPods trusts the text comparison only on browser renders, since raw app shells look
 * alike; here it is used only when the start page has words, which an empty shell does not.
 */
function soft404(graph: SiteGraph, i: number): Verdict {
  const page = graph.pages[i]
  const root = graph.start === null ? undefined : graph.pages[graph.start]
  if (page === undefined || root === undefined || page.status !== 200) return null
  const rootBase = withoutQuery(root.url)
  if (i === graph.start || withoutQuery(page.url) === rootBase) return false
  if (page.canonical !== null && withoutQuery(page.canonical) === rootBase) {
    return {
      fires: true,
      evidence: [{ url: page.url, note: 'Its canonical names the start page' }],
    }
  }
  if (root.wordCount > 0 && page.textHash === root.textHash) {
    return { fires: true, evidence: [{ url: page.url, note: 'Same text as the start page' }] }
  }
  return false
}

function withoutQuery(url: string): string {
  return normalizeUrl(url).split('?')[0] ?? url
}
