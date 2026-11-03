// Status, redirects and indexing (FlagRules.status and .indexing): whether search engines get the
// page at its own URL and may index it.
import type { Finding, SiteContext } from '../model'
import { count, finding } from './page-checks'
import { namesSelf } from './read'
import type { PageRead } from './read'

/** A refusal (a bot wall's 403 or 429) says nothing of the page's own status. */
const REFUSED = new Set([403, 429])
/** WorkPods' redirect_chain fires from two hops. */
const CHAIN = 2

export function indexingChecks(page: PageRead, site: SiteContext): Finding[] {
  return [
    status(page),
    ...redirects(page),
    blockedByRobots(page, site),
    ...(page.ok ? content(page) : notJudged(page)),
  ]
}

function status(page: PageRead): Finding {
  const { status, url } = page.snapshot
  const evidence = [{ url, value: String(status) }]
  if (REFUSED.has(status)) {
    const summary = `The site refused the request with ${status}, so the page's status is unknown.`
    return finding('non_200_status', 'not_applicable', summary, evidence)
  }
  return status === 200
    ? finding('non_200_status', 'pass', 'The page answered 200.', evidence)
    : finding('non_200_status', 'fail', `The page answered ${status}.`, evidence)
}

function redirects(page: PageRead): Finding[] {
  const hops = page.snapshot.redirects
  const evidence = hops.map((hop) => ({ url: hop.url, value: `${hop.status} to ${hop.location}` }))
  const last = hops.at(-1)
  const loop = last !== undefined && hops.some((hop) => hop.url === last.location)
  const moves = `The URL redirects ${count(hops.length, 'time')} before the page answers.`
  return [
    loop
      ? finding('redirect_loop', 'fail', `The redirects loop back to ${last.location}.`, evidence)
      : finding('redirect_loop', 'pass', 'The redirects do not loop.'),
    loop
      ? finding('redirect_chain', 'not_applicable', 'The redirects loop, so no page answers.')
      : finding('redirect_chain', hops.length >= CHAIN ? 'fail' : 'pass', moves, evidence),
  ]
}

function blockedByRobots(page: PageRead, site: SiteContext): Finding {
  if (site.robots === null) {
    return finding('blocked_by_robots', 'not_applicable', 'robots.txt was not read.')
  }
  const { url } = page.snapshot
  return site.robots.allows('Googlebot', url)
    ? finding('blocked_by_robots', 'pass', 'robots.txt lets Googlebot fetch this URL.')
    : finding('blocked_by_robots', 'fail', 'robots.txt blocks Googlebot from this URL.', [{ url }])
}

/** Canonical, noindex and the meta refresh are read only from a page that answered 2xx. */
function content(page: PageRead): Finding[] {
  const { url } = page.snapshot
  const canonical = page.canonical
  const elsewhere = canonical !== null && !namesSelf(canonical, url)
  const refresh = page.raw.head.refreshTo ?? page.rendered?.head.refreshTo ?? null
  const moved = refresh !== null && !namesSelf(refresh, url)
  return [
    canonical === null
      ? finding('canonical_mismatch', 'pass', 'The page declares no canonical.')
      : finding(
          'canonical_mismatch',
          elsewhere ? 'fail' : 'pass',
          elsewhere
            ? `The canonical names ${canonical}, not this URL.`
            : 'The canonical names this page.',
          [{ url: canonical }],
        ),
    page.noindex
      ? finding('noindex', 'fail', `The page is noindex by its ${page.noindexSource}.`)
      : finding('noindex', 'pass', 'Nothing marks the page noindex.'),
    missingCanonical(page),
    moved
      ? finding('browser_redirect', 'fail', 'A meta refresh sends visitors to another URL.', [
          { url: refresh },
        ])
      : finding('browser_redirect', 'pass', 'No meta refresh moves the visitor.'),
  ]
}

/** WorkPods asks a canonical only of an indexable page reached at its own URL. */
function missingCanonical(page: PageRead): Finding {
  const id = 'missing_canonical'
  if (page.canonical !== null) return finding(id, 'pass', 'The page declares a canonical.')
  if (page.noindex) return finding(id, 'pass', 'The page is noindex, so it needs no canonical.')
  if (page.snapshot.redirects.length > 0) {
    return finding(id, 'pass', 'The URL redirects, so the page it lands on is the canonical.')
  }
  return finding(id, 'fail', 'The page declares no canonical URL.', [{ url: page.snapshot.url }])
}

function notJudged(page: PageRead): Finding[] {
  const summary = `The page answered ${page.snapshot.status}, so this was not checked.`
  return ['canonical_mismatch', 'noindex', 'missing_canonical', 'browser_redirect'].map((id) =>
    finding(id, 'not_applicable', summary),
  )
}
