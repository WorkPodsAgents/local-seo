// What the panel's Local SEO screens receive from the service worker beyond the tools' results.
import type { LocalScanResult } from '@local-seo/core/bridge'
import type { ListStop } from '../readers/paging'
import type { FullAudit } from '../services/audit'
import type { SavedRead } from '../services/snapshots'

/** An audit with the history of the profile on this device. */
export interface BusinessView extends FullAudit {
  readonly history: SavedRead
}

export interface ScanView extends LocalScanResult {
  /** Why the list read ended, so the panel can say a list is partial. */
  readonly stoppedBy: ListStop
}

export interface Draft {
  /** The draft, within Google's limit for its kind. */
  readonly text: string
  /** For a services draft, the names one per entry; null for other drafts. */
  readonly services: readonly string[] | null
  /** Which model wrote it, such as "Claude (claude-sonnet-5-5)". */
  readonly model: string
}
