// Reads sitemaps breadth first, ported from WorkPods SitemapExpansion.kt: every child of an index
// is expanded, two levels below the roots, up to a file cap. A failed file is kept with its
// reason, never swallowed.
import type { Fetcher } from '../io'
import { fetchFile } from './fetch-file'
import { outcomeOf, type FileOutcome } from './outcome'
import { parseSitemap } from './sitemap-xml'

/** One sitemap file as read. */
export interface SitemapFile {
  readonly url: string
  readonly outcome: FileOutcome
  /** The HTTP status; null when no answer came. */
  readonly status: number | null
  readonly index: boolean
  /** The URLs (pages or child sitemaps) it lists. */
  readonly listed: number
  /** Why it could not be used, such as http_500 or not_xml; null when it was read. */
  readonly error: string | null
}

export interface SitemapRead {
  /** Page URLs listed, in order, without repeats, up to the URL cap. */
  readonly urls: readonly string[]
  readonly files: readonly SitemapFile[]
  /** A file or URL cap stopped the reading, so the list may miss pages. */
  readonly limited: boolean
}

/** Indexes of indexes are read to this depth below the roots. */
const MAX_DEPTH = 2
/** Each file is one request from the user's browser, so a large site is sampled. */
export const MAX_SITEMAP_FILES = 50
export const MAX_SITEMAP_URLS = 10_000

export async function readSitemaps(
  fetcher: Fetcher,
  roots: readonly string[],
): Promise<SitemapRead> {
  const files: SitemapFile[] = []
  const urls = new Set<string>()
  const seen = new Set<string>()
  let level = [...new Set(roots)]
  let limited = false
  for (let depth = 0; depth <= MAX_DEPTH && level.length > 0 && !limited; depth++) {
    const next: string[] = []
    for (const url of level) {
      if (seen.has(url)) continue
      seen.add(url)
      if (files.length >= MAX_SITEMAP_FILES) {
        limited = true
        break
      }
      const answer = await fetchFile(fetcher, url, 'application/xml, text/xml, */*')
      const outcome = outcomeOf(answer)
      const status = answer.response?.status ?? null
      if (outcome !== 'ok' || answer.response === null) {
        files.push({ url, outcome, status, index: false, listed: 0, error: errorOf(status) })
        continue
      }
      const parsed = parseSitemap(answer.response.body)
      const error = parsed.locs.length === 0 && !parsed.complete ? 'not_xml' : null
      files.push({ url, outcome, status, index: parsed.index, listed: parsed.locs.length, error })
      if (parsed.index) next.push(...parsed.locs)
      else {
        for (const loc of parsed.locs) {
          if (urls.size >= MAX_SITEMAP_URLS) limited = true
          else urls.add(loc)
        }
      }
    }
    level = next.filter((url) => !seen.has(url))
  }
  return { urls: [...urls], files, limited: limited || level.length > 0 }
}

function errorOf(status: number | null): string {
  return status === null ? 'unreachable' : `http_${status}`
}
