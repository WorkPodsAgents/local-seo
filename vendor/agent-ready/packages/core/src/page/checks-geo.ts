// Whether AI answers can read and name the page (AiReadability.kt): its content and schema without
// JavaScript, its AI crawlers' robots.txt access, and the home page's organization identity.
import type { AiCrawler, Finding, RobotsPolicy, SiteContext } from '../model'
import { threshold } from '../registry'
import { AI_CRAWLERS } from '../site'
import { count, finding } from './page-checks'
import type { PageRead } from './read'
import { organizationIdentity } from './organization'

export function geoChecks(page: PageRead, site: SiteContext): Finding[] {
  return [
    ...readability(page),
    aiCrawlerAccess(page.snapshot.url, site.robots, AI_CRAWLERS),
    organizationIdentity(page, site.brandName),
  ]
}

/** The plain answer, all that crawlers running no JavaScript read, against the rendered page. */
function readability(page: PageRead): Finding[] {
  const ids = ['ai_content_requires_js', 'schema_requires_js']
  if (!page.ok) {
    const summary = `The page answered ${page.snapshot.status}, so this was not checked.`
    return ids.map((id) => finding(id, 'not_applicable', summary))
  }
  const rendered = page.rendered
  if (rendered === null) {
    const summary = 'No rendered page was available to compare with the raw HTML.'
    return ids.map((id) => finding(id, 'not_applicable', summary))
  }
  return [
    contentNeedsJs(page.raw.words, page.raw.h1s.length, rendered.words, rendered.h1s.length),
    schemaNeedsJs(page.raw.schema.types, rendered.schema.types),
  ]
}

function contentNeedsJs(rawWords: number, rawH1: number, words: number, h1: number): Finding {
  const id = 'ai_content_requires_js'
  if (words === 0) return finding(id, 'not_applicable', 'The rendered page has no text.')
  const share = rawWords / words
  const evidence = [{ value: `${rawWords} of ${words} words` }]
  const held = `The HTML without JavaScript holds ${Math.round(share * 100)}% of the words.`
  if (share < threshold('ai_readability.min_text_share')) {
    return finding(id, 'fail', held, evidence)
  }
  if (h1 > 0 && rawH1 === 0) {
    return finding(id, 'fail', 'The H1 appears only after JavaScript runs.', evidence)
  }
  return finding(id, 'pass', held, evidence)
}

function schemaNeedsJs(rawTypes: readonly string[], renderedTypes: readonly string[]): Finding {
  const id = 'schema_requires_js'
  if (renderedTypes.length === 0) {
    return finding(id, 'not_applicable', 'The rendered page declares no structured data.')
  }
  const late = renderedTypes.filter((type) => !rawTypes.includes(type))
  return late.length === 0
    ? finding(id, 'pass', 'All structured data is in the HTML without JavaScript.')
    : finding(
        id,
        'fail',
        `${count(late.length, 'schema type')} appear only after JavaScript runs.`,
        late.map((type) => ({ value: type })),
      )
}

/**
 * Only crawlers that put pages into AI answers (search and user fetchers) count as blocked: a
 * training crawler kept out is the brand's policy, noted but never a fault. Some kept out is
 * partial; all of them, a fail.
 */
export function aiCrawlerAccess(
  url: string,
  robots: RobotsPolicy | null,
  crawlers: readonly AiCrawler[],
): Finding {
  const id = 'ai_crawler_blocked'
  const answering = crawlers.filter((crawler) => crawler.role !== 'training')
  if (robots === null) return finding(id, 'not_applicable', 'robots.txt was not read.')
  if (answering.length === 0) return finding(id, 'not_applicable', 'No AI crawlers are listed.')
  const blocked = answering.filter((crawler) => !robots.allows(crawler.token, url))
  const training = crawlers.filter(
    (crawler) => crawler.role === 'training' && !robots.allows(crawler.token, url),
  )
  const evidence = [
    ...blocked.map((crawler) => ({
      value: crawler.token,
      note: `${crawler.operator}, ${crawler.role}`,
    })),
    ...training.map((crawler) => ({
      value: crawler.token,
      note: `${crawler.operator}, training: kept out by the site's choice`,
    })),
  ]
  if (blocked.length === 0) {
    const summary = `robots.txt lets all ${answering.length} AI search and answer crawlers in.`
    return finding(id, 'pass', summary, evidence)
  }
  const share = `${blocked.length} of ${answering.length} AI search and answer crawlers`
  const summary = `robots.txt blocks ${share}.`
  return finding(id, blocked.length === answering.length ? 'fail' : 'partial', summary, evidence)
}
