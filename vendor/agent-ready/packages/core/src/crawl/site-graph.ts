// What the cross-page checks know about the crawl as a whole: how a URL maps to a crawled page,
// which URLs the sitemaps list, and what each page's own facts say about indexing.
import type { PageFacts } from '../model'

/** A crawled page a URL leads to, and whether the URL redirected to get there. */
export interface Landing {
  readonly page: number
  readonly redirected: boolean
}

export interface SiteGraph {
  readonly pages: readonly PageFacts[]
  readonly depth: readonly (number | null)[]
  readonly inlinks: readonly number[]
  /** The start page's index; null when it was not crawled. */
  readonly start: number | null
  landing(url: string): Landing | undefined
  /** Whether a sitemap lists the page, by any URL it was reached at. */
  listed(page: number): boolean
  /** The sitemaps were read whole, so a page they do not list is truly missing. */
  readonly sitemapComplete: boolean
  /** The crawl reached every page it found, so orphan and depth verdicts are measured. */
  readonly crawlComplete: boolean
}

/** A 2xx page, whose content and links the checks read. */
export function isContent(page: PageFacts): boolean {
  return page.status >= 200 && page.status < 300
}

/** The page declares a canonical other than itself. */
export function canonicalElsewhere(page: PageFacts): boolean {
  return page.canonical !== null && normalizeUrl(page.canonical) !== normalizeUrl(page.url)
}

/** A 2xx page with no noindex and no canonical elsewhere: one search engines may index. */
export function isIndexable(page: PageFacts): boolean {
  return isContent(page) && !page.noindex && !canonicalElsewhere(page)
}

/** The URL with its fragment removed, as the crawl keys pages; the input when it is no URL. */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.href
  } catch {
    return url
  }
}
