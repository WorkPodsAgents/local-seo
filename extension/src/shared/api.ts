// The messages the panel sends the service worker, and the events it sends back. One map types
// both ends, so a renamed field fails the build instead of a click. Feature lanes add their
// messages to Api, their paid actions to PaidArgs and PaidResults, and their events to Events.
import type { FetchRequest, FetchResponse } from '@open-agent-ready/core'
import type { Paid, Provider } from '@open-agent-ready/core/providers'
import type { SecretName } from '@open-agent-ready/core/secrets'
import type {
  AuditPart,
  BusinessRef,
  CategoryVolume,
  ToolArgs,
  ToolName,
  ToolResults,
} from '@local-seo/core/bridge'
import type { Business, Review } from '@local-seo/core/business'
import type { DraftKind } from '@local-seo/core/writers'
import type { ReadableTab } from '../readers/tab-client'
import type { GridProgress } from '../services/deps'
import type { BusinessView, Draft, ScanView } from './local'
import type { Settings, Status } from './settings'

/** The arguments of every paid action; `estimate` prices any of them before it runs. */
export interface PaidArgs {
  'paid:geo_grid': ToolArgs['geo_grid']
  'paid:read_reviews': ToolArgs['read_reviews']
  'paid:read_posts': ToolArgs['read_posts']
  'paid:category_volumes': { readonly categories: readonly string[]; readonly country: string }
  'paid:ai_answers': ToolArgs['local_ai_visibility']
}

/** What each paid action answers with; one entry per PaidArgs key. */
export interface PaidResults {
  'paid:geo_grid': ToolResults['geo_grid']
  'paid:read_reviews': ToolResults['read_reviews']
  'paid:read_posts': ToolResults['read_posts']
  'paid:category_volumes': readonly CategoryVolume[]
  'paid:ai_answers': ToolResults['local_ai_visibility']
}

/** The tools the panel runs for free, as the bridge's tools run them. */
export type FreeTool = Exclude<ToolName, 'local_ai_visibility'>

type LocalApi = { [K in FreeTool as `local:${K}`]: { in: ToolArgs[K]; out: ToolResults[K] } }

export type PaidOp = keyof PaidArgs

/** Any one paid action with its arguments, as `estimate` takes it. */
export type PaidRequest = { [K in PaidOp]: { op: K; args: PaidArgs[K] } }[PaidOp]

/** An estimated price in US dollars, as the provider bills it. */
export interface Cost {
  readonly provider: Provider
  readonly usd: number
}

type PaidApi = { [K in PaidOp]: { in: PaidArgs[K]; out: Paid<PaidResults[K]> } }

export interface Api extends PaidApi, LocalApi {
  estimate: { in: PaidRequest; out: Cost }
  status: { in: Record<string, never>; out: Status }
  'settings:save': { in: { settings: Settings }; out: Status }
  /** Saves the code `local-seo pair` printed; it is never sent back. */
  'bridge:pair': { in: { code: string }; out: Status }
  'vault:setup': { in: { passphrase: string; remember: boolean }; out: Status }
  'vault:unlock': { in: { passphrase: string; remember: boolean }; out: Status }
  'vault:lock': { in: Record<string, never>; out: Status }
  'vault:set': { in: { name: SecretName; value: string }; out: Status }
  'vault:remove': { in: { name: SecretName }; out: Status }
  'spend:cap': { in: { provider: Provider; usd: number }; out: Status }
  'data:wipe': { in: Record<string, never>; out: Status }
  /** A website's response, fetched by the service worker so redirect hops are visible. */
  'net:fetch': { in: FetchRequest; out: FetchResponse }
  /** Audits the place open in `tab`, or `ref` when the tab shows none. */
  'business:audit': {
    in: {
      tab: ReadableTab | null
      ref: BusinessRef | null
      include: AuditPart[]
      keyword: string | null
    }
    out: BusinessView
  }
  /** The last audit, for the panel on reopening and the report tab. */
  'business:last': { in: Record<string, never>; out: BusinessView | null }
  /** The Maps results list open in `tab`, read where the user is looking. */
  'scan:tab': { in: { tab: ReadableTab; max: number }; out: ScanView }
  /** Shows or hides the category labels on the results in `tab`; answers how many changed. */
  'overlay:set': { in: { tab: ReadableTab; on: boolean }; out: number }
  /** Stops a running grid after the point being read. */
  'grid:stop': { in: Record<string, never>; out: null }
  /** Assist mode: one assistant answers in the user's own tab, after the user presses Enter. */
  'answers:assist': { in: ToolArgs['local_ai_visibility']; out: ToolResults['local_ai_visibility'] }
  /** A draft from the user's model key; never published anywhere. */
  'draft:write': {
    in: {
      kind: DraftKind
      business: Business
      review?: Review
      topic?: string
      keyword?: string
    }
    out: Draft
  }
}

export type ApiType = keyof Api

export interface Events {
  status: Status
  'grid:progress': GridProgress
}

export type EventName = keyof Events

/** A request on the runtime message channel; messages with a `target` belong to other parts. */
export interface ApiRequest {
  readonly type: string
  readonly payload: unknown
}

export type ApiReply =
  { readonly ok: true; readonly result: unknown } | { readonly ok: false; readonly error: string }

export interface PanelEvent {
  readonly target: 'panel'
  readonly event: EventName
  readonly data: unknown
}

export function isApiRequest(message: unknown): message is ApiRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    !('target' in message) &&
    'type' in message &&
    typeof message.type === 'string'
  )
}
