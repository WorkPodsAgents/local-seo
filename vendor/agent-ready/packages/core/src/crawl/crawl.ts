// A polite crawl of one site: seeded from the start page, the pinned pages and the sitemaps,
// same origin only, honouring robots.txt for our token, one request at a time with a pause
// between requests, and stoppable. Pages are read through an injectable step so the crawl never
// depends on how a page is fetched or checked.
import type { Fetcher, HtmlParser, Sleep } from '../io'
import type { Finding, PageFacts } from '../model'
import { auditPage, extractFacts, fetchPage } from '../page'
import { fetchFile } from '../site/fetch-file'
import { robotsFromAnswer, type RobotsFile } from '../site/robots'
import { readSitemaps, type SitemapRead } from '../site/sitemaps'
import { crossPageChecks } from './checks'
import { linkGraph } from './graph'
import { crossPageFindings, type NotFoundProbe } from './rollup'
import { normalizeUrl, type Landing, type SiteGraph } from './site-graph'

/** The robots.txt product token the crawl answers to; groups for `*` apply when none names it. */
export const CRAWLER_TOKEN = 'OpenAgentReady'
export const DEFAULT_LIMIT = 200
export const DEFAULT_DELAY_MS = 500

/** One page read: what the crawl keeps of it and its on-page findings. */
export interface PageRead {
  readonly facts: PageFacts
  readonly findings: readonly Finding[]
}

/** Fetches and checks one page; rejects when no answer came. */
export type ReadPage = (url: string, robots: RobotsFile) => Promise<PageRead>

export interface CrawlOptions {
  readonly start: string
  /** Money pages the user wants crawled whatever links to them. */
  readonly pinned: readonly string[]
  /** Pages fetched at most, failures included. Defaults to 200. */
  readonly limit?: number
  /** The pause between requests, in milliseconds. Defaults to 500. */
  readonly delayMs?: number
  readonly fetcher: Fetcher
  readonly parse: HtmlParser
  readonly sleep: Sleep
  readonly signal: AbortSignal
  onProgress(done: number, queued: number, url: string): void
  /** Defaults to fetchPage, auditPage and extractFacts from the page checks. */
  readonly readPage?: ReadPage
}

export interface CrawledPage extends PageFacts {
  /** The URL the crawl asked for; `url` is where it landed. */
  readonly requested: string
  /** Clicks from the start page; null when no followed link reaches it. */
  readonly depth: number | null
  /** Distinct crawled pages linking to it. */
  readonly inlinks: number
  /** Its on-page findings, then the cross-page checks that fired on it. */
  readonly findings: readonly Finding[]
}

export type StoppedReason = 'done' | 'limit' | 'aborted'

export interface CrawlReport {
  readonly origin: string
  readonly pages: readonly CrawledPage[]
  /** One roll-up per cross-page check. */
  readonly findings: readonly Finding[]
  readonly stoppedReason: StoppedReason
  readonly sitemap: SitemapRead
  /** Same-origin URLs found but not fetched because robots.txt disallows our token. */
  readonly blockedByRobots: readonly string[]
  /** URLs fetched with no answer. */
  readonly unreachable: readonly string[]
  /** The made-up URL asked for to see how the site answers a missing page; null when aborted. */
  readonly notFoundProbe: NotFoundProbe | null
}

export async function crawlSite(options: CrawlOptions): Promise<CrawlReport> {
  const limit = options.limit ?? DEFAULT_LIMIT
  const delay = options.delayMs ?? DEFAULT_DELAY_MS
  const start = normalizeUrl(options.start)
  const origin = new URL(start).origin
  const readPage = options.readPage ?? defaultReadPage(options.fetcher, options.parse)
  const robotsAnswer = await fetchFile(options.fetcher, `${origin}/robots.txt`, 'text/plain')
  const robots = robotsFromAnswer(
    robotsAnswer.response?.status ?? null,
    robotsAnswer.response?.body ?? '',
  )
  const roots = robots.sitemaps.length > 0 ? robots.sitemaps : [`${origin}/sitemap.xml`]
  const sitemap = await readSitemaps(options.fetcher, roots)
  const sameOrigin = (url: string) => sameOriginUrl(url, origin)

  const frontier = new Frontier(sameOrigin, (url) => robots.allows(CRAWLER_TOKEN, url))
  frontier.add([start, ...options.pinned])
  frontier.addLater(sitemap.urls)

  const reads: { requested: string; read: PageRead }[] = []
  const landings = new Map<string, Landing>()
  const unreachable: string[] = []
  let fetched = 0
  let stoppedReason: StoppedReason = 'done'
  for (let url = frontier.next(); url !== undefined; url = frontier.next()) {
    if (fetched >= limit) {
      stoppedReason = 'limit'
      break
    }
    if (fetched > 0) await options.sleep(delay)
    if (options.signal.aborted) {
      stoppedReason = 'aborted'
      break
    }
    fetched++
    let read: PageRead
    try {
      read = await readPage(url, robots)
    } catch {
      if (options.signal.aborted) {
        stoppedReason = 'aborted'
        break
      }
      unreachable.push(url)
      options.onProgress(fetched, frontier.size, url)
      continue
    }
    record(reads, landings, url, read)
    frontier.add(read.facts.links.map((l) => l.url))
    frontier.add(read.facts.hreflang.map((h) => h.url))
    options.onProgress(fetched, frontier.size, url)
  }

  const probe = stoppedReason === 'aborted' ? null : await notFoundProbe(options, origin, delay)
  const pages = reads.map((r) => r.read.facts)
  const listed = new Set(sitemap.urls.map(normalizeUrl))
  const startPage = landings.get(start)?.page ?? null
  const metrics = linkGraph(pages, (url) => landings.get(normalizeUrl(url))?.page, startPage)
  const graph: SiteGraph = {
    pages,
    depth: metrics.map((m) => m.depth),
    inlinks: metrics.map((m) => m.inlinks),
    start: startPage,
    landing: (url) => landings.get(normalizeUrl(url)),
    listed: (i) => {
      const entry = reads[i]
      return entry !== undefined && (listed.has(entry.requested) || listed.has(pages[i]?.url ?? ''))
    },
    sitemapComplete:
      !sitemap.limited && sitemap.files.some((f) => f.outcome === 'ok' && f.error === null),
    crawlComplete: stoppedReason === 'done',
  }
  const cross = crossPageFindings(graph, crossPageChecks(graph), probe)
  return {
    origin,
    pages: reads.map(({ requested, read }, i) => ({
      ...read.facts,
      requested,
      depth: graph.depth[i] ?? null,
      inlinks: graph.inlinks[i] ?? 0,
      findings: [...read.findings, ...(cross.perPage[i] ?? [])],
    })),
    findings: cross.site,
    stoppedReason,
    sitemap,
    blockedByRobots: frontier.blocked,
    unreachable,
    notFoundProbe: probe,
  }
}

/**
 * Keeps a page once by where it landed: a URL that redirects to a page already read becomes one
 * more way to reach it.
 */
function record(
  reads: { requested: string; read: PageRead }[],
  landings: Map<string, Landing>,
  requested: string,
  read: PageRead,
): void {
  const final = normalizeUrl(read.facts.url)
  const known = landings.get(final)
  const page = known?.page ?? reads.length
  if (known === undefined) {
    reads.push({ requested, read })
    landings.set(final, { page, redirected: false })
  }
  const hops = [requested, ...read.facts.redirects.map((h) => h.url)].map(normalizeUrl)
  for (const hop of hops) {
    if (hop !== final && !landings.has(hop)) landings.set(hop, { page, redirected: true })
  }
}

async function notFoundProbe(
  options: CrawlOptions,
  origin: string,
  delay: number,
): Promise<NotFoundProbe> {
  await options.sleep(delay)
  const url = `${origin}/open-agent-ready-${crypto.randomUUID()}`
  const answer = await fetchFile(options.fetcher, url, 'text/html')
  return { url, status: answer.response?.status ?? null }
}

function defaultReadPage(fetcher: Fetcher, parse: HtmlParser): ReadPage {
  return async (url, robots) => {
    const snapshot = await fetchPage(fetcher, parse, url)
    return {
      facts: extractFacts(snapshot),
      findings: auditPage(snapshot, { robots, brandName: null }),
    }
  }
}

function sameOriginUrl(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.origin === origin && (parsed.protocol === 'https:' || parsed.protocol === 'http:')
  } catch {
    return false
  }
}

/**
 * The URLs left to fetch: links first, breadth first, then the sitemap URLs no link reached.
 * Each URL is queued once; one robots.txt disallows is kept aside instead.
 */
class Frontier {
  readonly blocked: string[] = []
  private readonly seen = new Set<string>()
  private readonly now: string[] = []
  private readonly later: string[] = []
  private head = 0
  private laterHead = 0

  constructor(
    private readonly inScope: (url: string) => boolean,
    private readonly allowed: (url: string) => boolean,
  ) {}

  get size(): number {
    return this.now.length - this.head + this.later.length - this.laterHead
  }

  add(urls: readonly string[]): void {
    for (const url of this.admit(urls)) this.now.push(url)
  }

  addLater(urls: readonly string[]): void {
    for (const url of this.admit(urls)) this.later.push(url)
  }

  next(): string | undefined {
    while (this.head < this.now.length || this.laterHead < this.later.length) {
      const url = this.head < this.now.length ? this.now[this.head++] : this.later[this.laterHead++]
      if (url !== undefined) return url
    }
    return undefined
  }

  private admit(urls: readonly string[]): string[] {
    const admitted: string[] = []
    for (const raw of urls) {
      const url = normalizeUrl(raw)
      if (this.seen.has(url) || !this.inScope(url)) continue
      this.seen.add(url)
      if (this.allowed(url)) admitted.push(url)
      else this.blocked.push(url)
    }
    return admitted
  }
}
