// The on-page checks: fetch a page as AI crawlers do, add the live render, and judge every SEO,
// GEO and AXO check a browser can judge, with the WorkPods registry's ids.
import type { Fetcher, HtmlParser } from '../io'
import type { Finding, PageFacts, PageSnapshot, SiteContext, Vitals } from '../model'
import { axoChecks } from './checks-axo'
import { contentChecks } from './checks-content'
import { geoChecks } from './checks-geo'
import { indexingChecks } from './checks-indexing'
import { speedChecks } from './checks-speed'
import { factsOf } from './facts'
import { PAGE_CHECKS } from './page-checks'
import { readPage } from './read'
import { addRendered, fetchSnapshot } from './snapshot'

export { PAGE_CHECKS } from './page-checks'
export type { PageCheck } from './page-checks'
export { seeAsAgent } from './agent-view'
export type { AgentView, DocumentView } from './agent-view'
export type { Heading } from './dom'
export type { DeclaredTool, ToolParam } from './webmcp'
export { selectorFor } from './selector'
export { accessibleName } from './accname'

/** Fetches a URL without JavaScript, following up to 10 redirects and recording each hop. */
export async function fetchPage(
  fetcher: Fetcher,
  parse: HtmlParser,
  url: string,
): Promise<PageSnapshot> {
  return fetchSnapshot(fetcher, parse, url)
}

/** Adds the live page's rendered HTML and vitals to a fetched snapshot. */
export function withRendered(
  snapshot: PageSnapshot,
  renderedHtml: string,
  parse: HtmlParser,
  vitals: Vitals | null,
): PageSnapshot {
  return addRendered(snapshot, renderedHtml, parse, vitals)
}

const ORDER: ReadonlyMap<string, number> = new Map(PAGE_CHECKS.map((entry, at) => [entry.id, at]))

/** Every on-page SEO, GEO and AXO check, in registry order. */
export function auditPage(snapshot: PageSnapshot, site: SiteContext): Finding[] {
  const page = readPage(snapshot)
  return [
    ...indexingChecks(page, site),
    ...contentChecks(page),
    ...speedChecks(snapshot.vitals),
    ...geoChecks(page, site),
    ...axoChecks(page),
  ].sort((a, b) => (ORDER.get(a.checkId) ?? 0) - (ORDER.get(b.checkId) ?? 0))
}

/** What a crawl keeps of a page. */
export function extractFacts(snapshot: PageSnapshot): PageFacts {
  return factsOf(snapshot)
}
