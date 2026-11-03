// The one file that calls the core's checks in Node, for the CLI and for the MCP tools when the
// extension is not connected. Results take the extension's own shapes (ToolResults), so an agent
// reads the same fields either way.
import type { Fetcher, HtmlParser } from '@open-agent-ready/core'
import { fetchPage } from '@open-agent-ready/core/page'
import { auditProfile } from '@local-seo/core/audit'
import type { NapFacts, WebsiteNapResult } from '@local-seo/core/bridge'
import type { Business, Known } from '@local-seo/core/business'
import { missing } from '@local-seo/core/business'
import { checkWebsite } from '@local-seo/core/nap'

export interface NodeDeps {
  readonly fetcher: Fetcher
  readonly parse: HtmlParser
  readonly now: () => Date
}

export const NO_BROWSER_NOTE =
  'Checked without a browser: the page was fetched from this computer and its JavaScript did ' +
  'not run, so details a script adds were not seen. The profile facts are the ones passed in, ' +
  'not read from Google.'

const NOT_GIVEN = 'not passed to the check'

/** Fetches `url` and compares it with `facts`; a fact left out is not compared. */
export async function checkWebsiteInNode(
  deps: NodeDeps,
  url: string,
  facts: NapFacts,
): Promise<WebsiteNapResult> {
  const snapshot = await fetchPage(deps.fetcher, deps.parse, url)
  const business = businessOf(facts, snapshot.url, deps.now())
  const website = checkWebsite(business, snapshot)
  const { findings } = auditProfile(business, { now: deps.now(), website })
  const notes = [NO_BROWSER_NOTE]
  if (snapshot.status >= 400) notes.push(`The page answered HTTP ${snapshot.status}.`)
  return {
    website,
    findings: findings.filter((entry) => entry.group === 'website'),
    profileFrom: 'arguments',
    notes,
  }
}

/**
 * The website checks take a whole profile; everything the agent did not pass is unknown, so
 * those checks stay not_applicable. `source` is never shown: the result says profileFrom.
 */
function businessOf(facts: NapFacts, url: string, now: Date): Business {
  const unknown = missing(NOT_GIVEN)
  const known = <T>(value: T | undefined): Known<T> => (value === undefined ? unknown : value)
  return {
    source: 'maps_page',
    readAt: now.toISOString(),
    ids: { placeId: null, cid: null, kgId: null, featureId: null },
    name: facts.name,
    categories: { primary: unknown, secondary: unknown },
    address:
      facts.address === undefined
        ? unknown
        : {
            formatted: facts.address,
            street: null,
            city: null,
            region: null,
            postalCode: null,
            country: null,
          },
    serviceAreas: unknown,
    location: unknown,
    phone: known(facts.phone),
    website: url,
    hours: unknown,
    attributes: unknown,
    services: unknown,
    products: unknown,
    description: unknown,
    rating: unknown,
    reviewCount: unknown,
    photoCount: unknown,
    claimed: unknown,
    closure: null,
  }
}
