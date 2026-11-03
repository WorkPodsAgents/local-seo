// Whether the home page has a Markdown version for agents: served on `Accept: text/markdown`, or
// named by its Link header as rel="alternate" type="text/markdown" on the same host.
import type { Fetcher } from '../io'
import { fetchFile, mediaType, resolve, type FileAnswer } from './fetch-file'

export interface MarkdownVersion {
  /** The home page asked for as Markdown. */
  readonly url: string
  /** The home page answered 2xx as text/markdown. */
  readonly servedOnAccept: boolean
  /** The Markdown version the Link header names; null when it names none on the same host. */
  readonly alternate: string | null
  /** The alternate answered 2xx as text/markdown; null when there is none. */
  readonly alternateServed: boolean | null
}

const MARKDOWN = 'text/markdown'

/** Asks for the home page as Markdown; returns the facts and the answer, whose URL is home. */
export async function readMarkdownVersion(
  fetcher: Fetcher,
  origin: string,
): Promise<{ readonly version: MarkdownVersion; readonly home: FileAnswer }> {
  const url = `${origin}/`
  const home = await fetchFile(fetcher, url, MARKDOWN)
  const alternate =
    markdownAlternates(home.response?.headers['link'], home.url).find(
      (href) => sameHost(href, home.url) && href !== home.url,
    ) ?? null
  const alternateServed =
    alternate === null ? null : servesMarkdown(await fetchFile(fetcher, alternate, MARKDOWN))
  return {
    version: { url, servedOnAccept: servesMarkdown(home), alternate, alternateServed },
    home,
  }
}

function servesMarkdown(answer: FileAnswer): boolean {
  const response = answer.response
  return (
    response !== null &&
    response.status >= 200 &&
    response.status < 300 &&
    mediaType(response) === MARKDOWN
  )
}

const LINK_PART = /<([^>]*)>([^,<]*)/g

/** The rel="alternate" type="text/markdown" targets of a Link header, resolved. */
export function markdownAlternates(header: string | undefined, base: string): string[] {
  if (header === undefined) return []
  const found: string[] = []
  for (const part of header.matchAll(LINK_PART)) {
    const params = new Map<string, string>()
    for (const param of (part[2] ?? '').split(';')) {
      const at = param.indexOf('=')
      if (at < 0) continue
      const value = param
        .slice(at + 1)
        .trim()
        .replace(/^"|"$/g, '')
        .trim()
      params.set(param.slice(0, at).trim().toLowerCase(), value)
    }
    const rel = (params.get('rel') ?? '').toLowerCase().split(/\s+/)
    const href = resolve(base, part[1] ?? '')
    if (rel.includes('alternate') && params.get('type')?.toLowerCase() === MARKDOWN && href) {
      found.push(href)
    }
  }
  return found
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host
  } catch {
    return false
  }
}
