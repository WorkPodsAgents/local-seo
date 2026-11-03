// Reads the files agents use on a site, ported from WorkPods AgentFiles.kt: its llms.txt, its AI
// catalog and the MCP server cards the catalog links to, its A2A agent card (the legacy
// agent.json only when the current card is absent) and the legacy ai-plugin.json. Each file is
// kept under the URL asked for; an answer that only stands in for a missing file is not found.
// What a file says is the site's data, never followed as instructions.
import type { Fetcher } from '../io'
import { checkAgentCard, checkCatalog, checkServerCard } from './agent-manifests'
import { fetchFile, resolve } from './fetch-file'
import type { FileProblem } from './file-problem'
import { llmsTxtProblems } from './llms-txt'
import { outcomeOf, type FileOutcome } from './outcome'
import { absenceReason, type AbsenceReason, type AgentFileKind } from './soft-absence'

/** One agent file as read. */
export interface AgentFile {
  readonly kind: AgentFileKind
  /** The URL asked for. */
  readonly url: string
  readonly outcome: FileOutcome
  /** The HTTP status; null when no answer came. */
  readonly status: number | null
  /** Why a 2xx answer counts as no file; null otherwise. */
  readonly absence: AbsenceReason | null
  /** How a present file breaks its standard; null when it was not read. */
  readonly problems: readonly FileProblem[] | null
  /** For a catalog: every server card it links to was read. Null for other files. */
  readonly complete: boolean | null
}

const WELL_KNOWN = '/.well-known'
const CARD_ACCEPT = 'application/mcp-server-card+json, application/json'
/** Server cards read per catalog; a catalog with more is incomplete. */
const MAX_CARDS = 5

/** The agent files at `origin`, judged against where its home page lands. */
export async function readAgentFiles(
  fetcher: Fetcher,
  origin: string,
  home: string,
): Promise<AgentFile[]> {
  const read = (kind: AgentFileKind, url: string, check: Check, accept = '*/*') =>
    readFile(fetcher, kind, url, accept, home, check)
  const llms = await read('llms_txt', `${origin}/llms.txt`, llmsTxtProblems)
  const catalog = await readCatalog(read, `${origin}${WELL_KNOWN}/ai-catalog.json`)
  const card = await read('a2a_agent_card', `${origin}${WELL_KNOWN}/agent-card.json`, (text) =>
    checkAgentCard(text, false),
  )
  const legacy =
    card.outcome === 'not_found'
      ? [
          await read('a2a_agent_card', `${origin}${WELL_KNOWN}/agent.json`, (text) =>
            checkAgentCard(text, true),
          ),
        ]
      : []
  // ai-plugin.json is only told apart from a stand-in here; it has no standard left to check.
  const plugin = await read('ai_plugin', `${origin}${WELL_KNOWN}/ai-plugin.json`, () => [])
  return [llms, ...catalog, card, ...legacy, plugin]
}

type Check = (text: string) => FileProblem[]
type Read = (kind: AgentFileKind, url: string, check: Check, accept?: string) => Promise<AgentFile>

/** The catalog, then the server cards it links to, one level deep. */
async function readCatalog(read: Read, url: string): Promise<AgentFile[]> {
  let linked: readonly string[] = []
  const catalog = await read('ai_catalog', url, (text) => {
    const checked = checkCatalog(text)
    linked = checked.cards
    return [...checked.problems]
  })
  const resolved = [...new Set(linked.map((card) => resolve(url, card)))].filter(
    (card): card is string => card !== null,
  )
  const cards: AgentFile[] = []
  for (const card of resolved.slice(0, MAX_CARDS)) {
    cards.push(await read('mcp_server_card', card, checkServerCard, CARD_ACCEPT))
  }
  const complete = resolved.length === linked.length && resolved.length <= MAX_CARDS
  return [catalog.outcome === 'ok' ? { ...catalog, complete } : catalog, ...cards]
}

async function readFile(
  fetcher: Fetcher,
  kind: AgentFileKind,
  url: string,
  accept: string,
  home: string,
  check: Check,
): Promise<AgentFile> {
  const answer = await fetchFile(fetcher, url, accept)
  const outcome = outcomeOf(answer)
  const status = answer.response?.status ?? null
  const base = { kind, url, status, complete: null }
  if (outcome !== 'ok' || answer.response === null) {
    return { ...base, outcome, absence: null, problems: null }
  }
  const absence = absenceReason(kind, url, answer.url, answer.response, home)
  if (absence !== null) return { ...base, outcome: 'not_found', absence, problems: null }
  return { ...base, outcome, absence: null, problems: check(answer.response.body) }
}
