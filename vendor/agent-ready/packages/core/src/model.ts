// The shapes every check, crawl and report shares. A check never touches Chrome, the network or
// the clock directly: it gets a parsed page and, when it needs more, the seams in io.ts.
import type { Severity } from './registry'

/** The four layers of the search funnel. ACO is reserved for product-feed checks. */
export type Layer = 'seo' | 'geo' | 'axo' | 'aco'

/** The on-page checklist groups, in the order the WorkPods dashboard shows them. */
export type CheckGroup =
  | 'indexing'
  | 'title_meta'
  | 'headings_content'
  | 'structured_media'
  | 'links'
  | 'international'
  | 'speed'
  | 'ai_readiness'

export const CHECK_GROUP_LABEL: Readonly<Record<CheckGroup, string>> = {
  indexing: 'Indexing & crawl',
  title_meta: 'Title & meta',
  headings_content: 'Headings & content',
  structured_media: 'Structured data & media',
  links: 'Links',
  international: 'International',
  speed: 'Speed',
  ai_readiness: 'AI readiness',
}

/**
 * A check's outcome. `partial` means part of it holds (some images lack alt text, one crawler of
 * five is blocked). `not_applicable` means the check has nothing to judge (no hreflang declared,
 * no agent manifest published), which is never a fail.
 */
export type Status = 'pass' | 'partial' | 'fail' | 'not_applicable'

/** Where a finding points: an element on the page, a URL, or a quoted value. */
export interface Evidence {
  /** A CSS selector that finds the element in the rendered page, for highlighting. */
  readonly selector?: string
  readonly url?: string
  /** The offending value as found, such as the title text or the robots.txt line. */
  readonly value?: string
  readonly note?: string
}

export interface Finding {
  /** A WorkPods registry id (check-registry.json). */
  readonly checkId: string
  readonly layer: Layer
  readonly group: CheckGroup
  readonly status: Status
  /** The severity when the status is fail or partial; null on pass and not applicable. */
  readonly severity: Severity | null
  /** One plain sentence saying what was found, such as "The title is 74 characters". */
  readonly summary: string
  readonly evidence: readonly Evidence[]
}

/** One hop of a redirect chain, in the order it was followed. */
export interface RedirectHop {
  readonly url: string
  readonly status: number
  readonly location: string
}

/** Field or lab readings from the live tab; null when the browser could not measure them. */
export interface Vitals {
  readonly lcpMs: number | null
  readonly cls: number | null
}

/**
 * A page as the checks see it. `raw` is the HTML a fetcher gets with no JavaScript, which is what
 * AI crawlers read. `rendered` is the live page after scripts ran, or null where no browser was
 * available (the CLI), in which case the checks that compare the two are not applicable.
 */
export interface PageSnapshot {
  /** The final URL after redirects. */
  readonly url: string
  readonly requestedUrl: string
  readonly status: number
  /** Response headers, keys lower-cased. */
  readonly headers: Readonly<Record<string, string>>
  readonly redirects: readonly RedirectHop[]
  readonly rawHtml: string
  readonly raw: Document
  readonly rendered: Document | null
  readonly vitals: Vitals | null
}

/** A link as a page declares it. */
export interface PageLink {
  /** Absolute, fragment removed. */
  readonly url: string
  readonly rel: readonly string[]
  readonly text: string
  readonly internal: boolean
}

export interface HreflangAlternate {
  readonly lang: string
  readonly url: string
}

/**
 * What a crawl keeps of each page: enough for the cross-page checks (duplicates, orphans, depth,
 * broken links, hreflang return links) without holding every Document in memory.
 */
export interface PageFacts {
  readonly url: string
  readonly status: number
  readonly redirects: readonly RedirectHop[]
  readonly contentType: string | null
  readonly title: string | null
  readonly metaDescription: string | null
  readonly h1s: readonly string[]
  /** Absolute canonical URL, or null when none is declared. */
  readonly canonical: string | null
  /** True when robots meta or X-Robots-Tag says noindex. */
  readonly noindex: boolean
  readonly links: readonly PageLink[]
  readonly hreflang: readonly HreflangAlternate[]
  readonly wordCount: number
  /** A hash of the normalised main text, so equal content compares equal. */
  readonly textHash: string
}

/** A parsed robots.txt, answering for one crawler token at a time. */
export interface RobotsPolicy {
  /** True when `userAgent` (a product token such as GPTBot) may fetch `url`. */
  allows(userAgent: string, url: string): boolean
  readonly sitemaps: readonly string[]
}

/** What an AI crawler fetches for. */
export type CrawlerRole = 'training' | 'search_index' | 'user_fetch'

export interface AiCrawler {
  /** The robots.txt product token, such as GPTBot or ClaudeBot. */
  readonly token: string
  readonly operator: string
  readonly role: CrawlerRole
}

/** Site-wide facts a page check can use; null members were not fetched. */
export interface SiteContext {
  readonly robots: RobotsPolicy | null
  /** The brand name the user gave, for the organization identity check. */
  readonly brandName: string | null
}
