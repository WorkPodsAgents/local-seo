// The site files probe: robots.txt, sitemaps, the files agents read and the home page's Markdown
// version, read one request at a time, with the facts the UI shows and the site-level findings.
import type { Fetcher } from '../io'
import type { AiCrawler, Finding } from '../model'
import { readAgentFiles, type AgentFile } from './agent-files'
import { agentManifestFinding, llmsTxtFinding } from './agent-file-findings'
import type { ContentSignal } from './content-signal'
import { AI_CRAWLERS } from './crawlers'
import { fetchFile } from './fetch-file'
import { readMarkdownVersion, type MarkdownVersion } from './markdown-version'
import { robotsFromAnswer, type RobotsFile } from './robots'
import { readSitemaps, type SitemapRead } from './sitemaps'

/** Whether an AI crawler may fetch the home page under robots.txt. */
export interface CrawlerAccess extends AiCrawler {
  readonly allowed: boolean
}

/** What the probe found that is no check verdict, for the site files view. */
export interface SiteFacts {
  readonly robotsUrl: string
  /** The HTTP status of robots.txt; null when no answer came. */
  readonly robotsStatus: number | null
  /** Content-Signal lines of robots.txt, each with its group. */
  readonly contentSignals: readonly ContentSignal[]
  readonly aiCrawlers: readonly CrawlerAccess[]
  readonly agentFiles: readonly AgentFile[]
  readonly markdown: MarkdownVersion
}

export interface SiteFilesReport {
  /** Scheme, host and port, with no trailing slash. */
  readonly origin: string
  readonly robots: RobotsFile
  readonly sitemap: SitemapRead
  readonly facts: SiteFacts
  /** llms_txt_invalid and agent_manifest_invalid. */
  readonly findings: readonly Finding[]
}

export async function probeSiteFiles(origin: string, fetcher: Fetcher): Promise<SiteFilesReport> {
  const base = new URL(origin).origin
  const robotsUrl = `${base}/robots.txt`
  const robotsAnswer = await fetchFile(fetcher, robotsUrl, 'text/plain')
  const robotsStatus = robotsAnswer.response?.status ?? null
  const robots = robotsFromAnswer(robotsStatus, robotsAnswer.response?.body ?? '')
  const roots = robots.sitemaps.length > 0 ? robots.sitemaps : [`${base}/sitemap.xml`]
  const sitemap = await readSitemaps(fetcher, roots)
  const { version, home } = await readMarkdownVersion(fetcher, base)
  const agentFiles = await readAgentFiles(fetcher, base, home.url)
  const homeUrl = `${base}/`
  return {
    origin: base,
    robots,
    sitemap,
    facts: {
      robotsUrl,
      robotsStatus,
      contentSignals: robots.contentSignals,
      aiCrawlers: AI_CRAWLERS.map((c) => ({ ...c, allowed: robots.allows(c.token, homeUrl) })),
      agentFiles,
      markdown: version,
    },
    findings: [llmsTxtFinding(agentFiles), agentManifestFinding(agentFiles)],
  }
}
