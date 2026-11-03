// "See as AI": the page as a crawler running no JavaScript reads it beside the rendered page, for
// the side panel and the see_as_agent tool. Plain data, so it crosses the bridge as JSON.
import type { PageSnapshot } from '../model'
import type { Heading } from './dom'
import type { DocumentRead } from './read'
import { readPage } from './read'
import { declaredTools } from './webmcp'
import type { DeclaredTool } from './webmcp'

export interface DocumentView {
  readonly words: number
  readonly headings: readonly Heading[]
  readonly schemaTypes: readonly string[]
  readonly links: number
}

export interface AgentView {
  readonly url: string
  readonly status: number
  /** The HTML without JavaScript: what AI crawlers read. */
  readonly raw: DocumentView
  /** Null where no browser rendered the page. */
  readonly rendered: DocumentView | null
  /** The raw words over the rendered words; null without a rendered page with text. */
  readonly textShare: number | null
  /** The rendered page's declarative WebMCP tools, else the raw answer's. */
  readonly webMcpTools: readonly DeclaredTool[]
  /** The start of the raw answer's visible text. */
  readonly rawExcerpt: string
}

const EXCERPT_CHARS = 2_000

export function seeAsAgent(snapshot: PageSnapshot): AgentView {
  const page = readPage(snapshot)
  const rendered = page.rendered
  return {
    url: snapshot.url,
    status: snapshot.status,
    raw: viewOf(page.raw),
    rendered: rendered === null ? null : viewOf(rendered),
    textShare: rendered === null || rendered.words === 0 ? null : page.raw.words / rendered.words,
    webMcpTools: declaredTools(page.shown.doc),
    rawExcerpt: page.raw.text.slice(0, EXCERPT_CHARS),
  }
}

function viewOf(read: DocumentRead): DocumentView {
  return {
    words: read.words,
    headings: read.headings,
    schemaTypes: read.schema.types,
    links: read.links.length,
  }
}
