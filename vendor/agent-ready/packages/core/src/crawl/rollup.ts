// Turns the cross-page verdicts into findings: one per firing page, and one site-wide roll-up per
// check that says how many of the judged pages it fired on.
import type { Evidence, Finding, Status } from '../model'
import { count, finding } from '../site/finding'
import type { CrossPageCheck } from './checks'
import type { SiteGraph } from './site-graph'

/** A request for a URL that cannot exist, which a site should answer 404 or 410. */
export interface NotFoundProbe {
  readonly url: string
  /** The final status after redirects; null when no answer came. */
  readonly status: number | null
}

const MAX_EVIDENCE = 20

export interface CrossPageFindings {
  /** The firing findings of each page, by page index. */
  readonly perPage: readonly Finding[][]
  readonly site: readonly Finding[]
}

export function crossPageFindings(
  graph: SiteGraph,
  checks: readonly CrossPageCheck[],
  probe: NotFoundProbe | null,
): CrossPageFindings {
  const perPage: Finding[][] = graph.pages.map(() => [])
  const site = checks.map((check) => {
    let judged = 0
    const firing: Evidence[] = []
    graph.pages.forEach((page, i) => {
      const verdict = check.judge(i)
      if (verdict === null) return
      judged++
      if (verdict === false) return
      firing.push({ url: page.url })
      const summary = `This page ${check.one}.`
      perPage[i]?.push(finding(check.id, 'seo', check.group, 'fail', summary, verdict.evidence))
    })
    const rollup = rollUp(check, judged, firing, graph)
    return check.id === 'soft_404' && probe !== null ? withProbe(rollup, probe) : rollup
  })
  return { perPage, site }
}

function rollUp(
  check: CrossPageCheck,
  judged: number,
  firing: readonly Evidence[],
  graph: SiteGraph,
): Finding {
  const evidence = firing.slice(0, MAX_EVIDENCE)
  const make = (status: Status, summary: string) =>
    finding(check.id, 'seo', check.group, status, summary, evidence)
  if (judged === 0) return make('not_applicable', unjudged(check, graph))
  if (firing.length === 0)
    return make('pass', `None of the ${count(judged, 'page')} checked ${check.many}.`)
  const status = firing.length === judged ? 'fail' : 'partial'
  return make(status, `${firing.length} of ${count(judged, 'page')} checked ${check.many}.`)
}

function unjudged(check: CrossPageCheck, graph: SiteGraph): string {
  const graphCheck = check.id === 'orphan_page' || check.id === 'deep_page'
  if (graphCheck && !graph.crawlComplete) {
    return 'The crawl stopped before it reached every page, so this cannot be judged.'
  }
  if (check.id === 'missing_from_sitemap' && !graph.sitemapComplete) {
    return 'No complete sitemap was read, so this cannot be judged.'
  }
  return 'No crawled page had anything for this check to judge.'
}

/** A made-up URL answering 200 is a soft 404 whatever the crawled pages show. */
function withProbe(rollup: Finding, probe: NotFoundProbe): Finding {
  if (probe.status === 200) {
    const pages =
      rollup.status === 'pass' || rollup.status === 'not_applicable' ? '' : ` ${rollup.summary}`
    const evidence = [{ url: probe.url, note: 'A made-up URL answered 200' }, ...rollup.evidence]
    const summary = `A made-up URL answered 200 instead of 404.${pages}`
    return finding(rollup.checkId, rollup.layer, rollup.group, 'fail', summary, evidence)
  }
  const gone = probe.status === 404 || probe.status === 410
  if (rollup.status !== 'not_applicable' || !gone) return rollup
  const summary = `A made-up URL answered ${probe.status ?? ''}, as a missing page should.`
  return finding(rollup.checkId, rollup.layer, rollup.group, 'pass', summary, [{ url: probe.url }])
}
