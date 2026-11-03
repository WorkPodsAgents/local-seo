// What a report renders: the findings of one page audit or one crawl, with the notes a reader
// needs to judge them (such as checks that could not run without a browser).
import type { Finding } from '../model'

export interface PageReport {
  readonly kind: 'page'
  readonly url: string
  readonly findings: readonly Finding[]
  readonly notes: readonly string[]
}

/** A crawl's cross-page findings; the caller maps the crawl's own report to this shape. */
export interface SiteReport {
  readonly kind: 'site'
  readonly url: string
  readonly pagesCrawled: number
  /** Why the crawl ended early (the page limit, the user stopped it), or null when it finished. */
  readonly stopReason: string | null
  readonly findings: readonly Finding[]
  readonly notes: readonly string[]
}

export type Report = PageReport | SiteReport
