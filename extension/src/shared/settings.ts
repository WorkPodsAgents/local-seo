// What the user sets in Settings, and the connection state the header shows.
import type { SpendSummary } from '@open-agent-ready/core/providers'
import type { SecretName } from '@open-agent-ready/core/secrets'

export interface Settings {
  /** How many days a paid answer is reused before it is bought again. */
  readonly cacheDays: number
  /** True when the extension should keep a link open to the local MCP bridge. */
  readonly agentLink: boolean
}

export const DEFAULT_SETTINGS: Settings = { cacheDays: 7, agentLink: false }

export type VaultState = 'empty' | 'locked' | 'unlocked'

/**
 * `unpaired`: on, but no pairing code entered yet. `mismatch`: the bridge refused this
 * extension's code, or whatever answered could not prove it holds it.
 */
export type LinkState = 'off' | 'unpaired' | 'connecting' | 'connected' | 'waiting' | 'mismatch'

/** Everything the header chips and Settings need, without a single secret value. */
export interface Status {
  readonly vault: VaultState
  /** True when the vault key is remembered on this device. */
  readonly remembered: boolean
  /** Which secrets are stored; their values never leave the service worker. */
  readonly stored: readonly SecretName[]
  readonly link: LinkState
  /** A pairing code is saved; the code itself is never shown again. */
  readonly paired: boolean
  readonly spend: SpendSummary
  readonly settings: Settings
  /** Background work that failed with no one waiting on it, in plain words; null when none. */
  readonly problem: string | null
}
