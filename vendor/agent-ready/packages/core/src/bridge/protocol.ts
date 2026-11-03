// The messages between the local bridge (an MCP server the user's agent starts) and the extension.
// The bridge listens on 127.0.0.1 and accepts a WebSocket only from this extension's origin; the
// extension connects out to it. Paid provider calls run inside the extension with the user's keys,
// so no credential ever crosses this link.

export const EXTENSION_ID = 'pkkpkklkaaddigbdoinfaedbafmegjlp'
export const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`
/** The port the bridge listens on; the extension tries it when the bridge is running. */
export const BRIDGE_PORT = 47821

/** Every tool the extension serves, with its arguments. Results are JSON as each lane documents. */
export interface ToolArgs {
  audit_page: { url: string; brandName?: string }
  crawl_site: { url: string; limit?: number; pinned?: string[] }
  site_files: { url: string }
  see_as_agent: { url: string }
  compare_pages: { url: string; competitorUrl: string }
  read_ai_answer: { tabUrl?: string; brand: string; competitors?: string[]; domains?: string[] }
  keyword_ideas: { seeds: string[]; location?: string; language?: string; limit?: number }
  keyword_gap: { domain: string; competitors: string[]; location?: string; limit?: number }
  backlinks_summary: { target: string }
  link_gap: { domain: string; competitors: string[]; limit?: number }
  journey_observe: { journeyId?: string; url?: string; task?: string }
  journey_act: { journeyId: string; action: JourneyAction }
}

export type ToolName = keyof ToolArgs

/** One step an agent asks for. Submitting forms, final buttons and sign-in are refused. */
export type JourneyAction =
  | { kind: 'click'; ref: string }
  | { kind: 'type'; ref: string; text: string }
  | { kind: 'select'; ref: string; value: string }
  | { kind: 'navigate'; url: string }
  | { kind: 'scroll'; direction: 'up' | 'down' }
  | {
      kind: 'finish'
      outcome: 'completed_read_only' | 'reached_confirmation' | 'partial' | 'blocked'
      note: string
    }

export interface BridgeRequest<T extends ToolName = ToolName> {
  readonly id: string
  readonly tool: T
  readonly args: ToolArgs[T]
}

export type BridgeResponse =
  | { readonly id: string; readonly ok: true; readonly result: unknown }
  | { readonly id: string; readonly ok: false; readonly error: string }
