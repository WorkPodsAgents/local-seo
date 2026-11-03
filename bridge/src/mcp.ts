// `local-seo mcp`: the stdio MCP server an agent starts. Each tool call goes to the extension over
// the local link, where it runs with the user's own browser, keys and spend caps. The website
// check alone can also run here in Node, for agents without the extension.
//
// No paid tool runs in Node: DataForSEO keys live only in the extension's vault and never reach
// the bridge, so a paid source without the extension fails with the connect message.
import type { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { BRIDGE_PORT, NO_HOST_ACCESS, pairingCode } from '@local-seo/core/bridge'
import { bridgeOrigin } from './origin'
import type { ToolArgs, ToolName } from '@local-seo/core/bridge'
import type { NodeDeps } from './core-adapter'
import { checkWebsiteInNode } from './core-adapter'
import { ExtensionLink } from './extension-link'
import { TOOL_DESCRIPTIONS, TOOL_TITLES } from './tool-descriptions'
import { SHAPES } from './tools'

const MINUTE = 60_000

type Timeouts = Readonly<Record<ToolName, number>>

/** How long the extension may take: reading Maps waits on real pages loading and scrolling. */
const TIMEOUT_MS: Timeouts = {
  find_business: MINUTE,
  // Profile, reviews, posts, website and competitors, each a page load or a scrolled list.
  audit_profile: 6 * MINUTE,
  // 500 reviews scroll for minutes; a DataForSEO reviews task can queue for 5.
  read_reviews: 8 * MINUTE,
  read_posts: 6 * MINUTE,
  // withDetails opens up to 120 profiles, a few seconds each.
  local_scan: 15 * MINUTE,
  rank_at: 2 * MINUTE,
  // A 5x5 browser grid is 25 Maps searches, each a full page load and a pause.
  geo_grid: 30 * MINUTE,
  category_ideas: 4 * MINUTE,
  check_website_nap: 2 * MINUTE,
  compare_businesses: 10 * MINUTE,
  profile_history: MINUTE,
  // Up to four assistants, each composing an answer.
  local_ai_visibility: 8 * MINUTE,
}

/** A tool Node can answer when no extension is connected; null when these args need it. */
type Fallbacks = {
  readonly [T in ToolName]?: (args: ToolArgs[T], deps: NodeDeps) => Promise<unknown> | null
}

const FALLBACKS: Fallbacks = {
  check_website_nap: (args, deps) =>
    args.url === undefined || args.profile === undefined
      ? null
      : checkWebsiteInNode(deps, args.url, args.profile),
}

export function createMcpServer(
  link: ExtensionLink,
  version: string,
  deps: NodeDeps,
  timeouts: Timeouts = TIMEOUT_MS,
): McpServer {
  const server = new McpServer({ name: 'local-seo', version })
  for (const tool of Object.keys(SHAPES) as ToolName[]) {
    register(server, tool, (args) => run(link, deps, timeouts[tool], tool, args))
  }
  return server
}

function register<T extends ToolName>(
  server: McpServer,
  tool: T,
  call: (args: ToolArgs[T]) => Promise<CallToolResult>,
): void {
  // Widened so the SDK's conditional callback type resolves; withoutUndefined restores ToolArgs.
  const inputSchema: z.ZodRawShape = SHAPES[tool]
  server.registerTool(
    tool,
    {
      title: TOOL_TITLES[tool],
      description: TOOL_DESCRIPTIONS[tool],
      inputSchema,
      // Every tool only reads (v1 writes nothing to a Business Profile) and reaches Google.
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (parsed) => call(withoutUndefined<T>(parsed)),
  )
}

async function run<T extends ToolName>(
  link: ExtensionLink,
  deps: NodeDeps,
  timeoutMs: number,
  tool: T,
  args: ToolArgs[T],
): Promise<CallToolResult> {
  const fallback: Fallbacks[T] = FALLBACKS[tool]
  const inNode = () => (fallback === undefined ? null : fallback(args, deps))
  try {
    const node = link.connected() ? null : inNode()
    const result = await (node ?? link.call(tool, args, timeoutMs).catch(noSiteAccess(inNode)))
    return text(JSON.stringify(result))
  } catch (error) {
    // ExtensionNotConnected included: its message tells the user how to connect.
    if (error instanceof Error) return failure(error.message)
    throw error
  }
}

/** An extension not yet allowed on the site leaves the check to Node, when Node can run it. */
function noSiteAccess(inNode: () => Promise<unknown> | null) {
  return (error: unknown): Promise<unknown> => {
    const node =
      error instanceof Error && error.message.startsWith(NO_HOST_ACCESS) ? inNode() : null
    if (node === null) throw error
    return node
  }
}

/**
 * The SDK has validated `parsed` against SHAPES[tool], and ShapesMatchProtocol proves those
 * shapes equal ToolArgs once undefined members are dropped, which is what this does.
 */
function withoutUndefined<T extends ToolName>(parsed: object): ToolArgs[T] {
  const entries = Object.entries(parsed).filter(([, value]) => value !== undefined)
  return Object.fromEntries(entries) as ToolArgs[T]
}

function text(body: string): CallToolResult {
  return { content: [{ type: 'text', text: body }] }
}

function failure(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

/** stdout carries the MCP protocol, so everything else goes to stderr. */
function log(line: string): void {
  process.stderr.write(`local-seo: ${line}\n`)
}

export async function runMcp(
  version: string,
  deps: NodeDeps,
  secret: Uint8Array<ArrayBuffer>,
  firstRun: boolean,
): Promise<void> {
  if (firstRun) {
    log(`Pairing code: ${pairingCode(secret)}`)
    log('Enter it once in the Local SEO extension: Settings, Agent connection.')
  }
  const link = new ExtensionLink({
    port: BRIDGE_PORT,
    allowedOrigin: bridgeOrigin(process.env.LOCAL_SEO_EXTENSION_ORIGIN),
    secret,
    log,
    // Past the extension's longest retry gap (one minute), so its next attempt is caught.
    connectWaitMs: 75_000,
  })
  const server = createMcpServer(link, version, deps)
  await server.connect(new StdioServerTransport())
  log(`MCP server ready; waiting for the extension on 127.0.0.1:${BRIDGE_PORT}.`)
}
