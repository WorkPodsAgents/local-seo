// The crawl's link graph, ported from WorkPods GraphAlgorithm.kt: click depth by BFS from the
// start page and distinct inlinks per page, self links dropped. A link to a URL that redirects
// counts for the page it lands on, as WorkPods counts redirect edges.
import type { PageFacts } from '../model'

export interface GraphMetrics {
  /** Clicks from the start page; null when no followed link reaches the page. */
  readonly depth: number | null
  /** Distinct crawled pages linking to it. */
  readonly inlinks: number
}

/**
 * `pageOf` finds the crawled page a URL leads to (by its own URL or a redirect hop), as an index
 * into `pages`; `start` is the start page's index, or null when it was not crawled.
 */
export function linkGraph(
  pages: readonly PageFacts[],
  pageOf: (url: string) => number | undefined,
  start: number | null,
): GraphMetrics[] {
  const out = pages.map(() => new Set<number>())
  const inlinks = pages.map(() => new Set<number>())
  pages.forEach((page, from) => {
    for (const link of page.links) {
      const to = pageOf(link.url)
      if (to === undefined || to === from) continue
      out[from]?.add(to)
      inlinks[to]?.add(from)
    }
  })
  const depth: (number | null)[] = pages.map(() => null)
  if (start !== null) {
    depth[start] = 0
    const queue = [start]
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head] ?? 0
      for (const target of out[current] ?? []) {
        if (depth[target] !== null) continue
        depth[target] = (depth[current] ?? 0) + 1
        queue.push(target)
      }
    }
  }
  return pages.map((_, i) => ({ depth: depth[i] ?? null, inlinks: inlinks[i]?.size ?? 0 }))
}
