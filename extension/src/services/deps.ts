// Everything the Local SEO services reach outside themselves: the Maps tab, storage, the paid
// providers, the website fetch and the assistants. The service worker wires the real ones once
// (background/local.ts); tests pass fakes, so every tool runs in a test without Chrome or the
// network.
import type { AiSource } from '@local-seo/core/bridge'
import type { Business } from '@local-seo/core/business'
import type { WebsiteCheck } from '@local-seo/core/nap'
import type { LocalDataForSeo } from '@local-seo/core/providers/dataforseo-local'
import type { KeywordMetrics, Paid, Provider } from '@open-agent-ready/core/providers'
import type { AnswerDeps } from '../answers/visibility'
import type { MapsPage } from '../maps/page'
import type { ReviewPages } from './review-pages'
import type { SnapshotStore } from './snapshots'

export interface WebsiteRead {
  readonly website: WebsiteCheck
  /** The HTTP status the page answered with. */
  readonly status: number
}

export interface GridProgress {
  readonly done: number
  readonly total: number
}

export interface LocalDeps {
  /** Runs `work` with the Maps tab the services read in, one user at a time. */
  readonly maps: <T>(work: (page: MapsPage) => Promise<T>) => Promise<T>
  readonly snapshots: SnapshotStore
  readonly reviewPages: ReviewPages
  readonly dataForSeo: LocalDataForSeo
  /** Monthly searches for each name in a country (ISO alpha-2), from DataForSEO Labs. */
  readonly keywordVolumes: (
    names: readonly string[],
    country: string,
  ) => Promise<Paid<readonly KeywordMetrics[]>>
  /** True once DataForSEO credentials are saved; a free tool then may add paid extras. */
  readonly hasDataForSeo: () => Promise<boolean>
  /** Why a paid run of `usd` may not start (no keys, no cap, over the cap); null when it may. */
  readonly paidBlock: (provider: Provider, usd: number) => Promise<string | null>
  /** Runs a paid call, turning a provider failure into a sentence the user can act on. */
  readonly paid: <T>(call: () => Promise<T>) => Promise<T>
  /** Fetches the page and compares it with the profile; throws without the site permission. */
  readonly website: (business: Business, url: string) => Promise<WebsiteRead>
  /** The assistants as `source` reaches them: the user's tabs, or Cloro with the user's key. */
  readonly answers: (source: AiSource) => Promise<AnswerDeps>
  readonly now: () => Date
  readonly sleep: (ms: number) => Promise<void>
  /** Pause between two browser grid searches. */
  readonly gridPauseMs: number
  /** True once the user pressed Stop on a running grid. */
  readonly gridStopped: () => boolean
  readonly onGridProgress: (progress: GridProgress) => void
}
