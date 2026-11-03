import type { SecretName } from '@open-agent-ready/core/secrets'
import type { LinkState, Status } from '../shared/settings'
import type { SettingsSection } from './open-settings'

export type Light = 'ready' | 'attention' | 'off'

export interface Connection {
  readonly name: string
  readonly light: Light
  readonly state: string
  /** Where the connection is set up. */
  readonly section: SettingsSection
}

const MODEL_KEYS: readonly SecretName[] = ['anthropic_key', 'openai_key', 'gemini_key']

const LINK: Readonly<Record<LinkState, { light: Light; state: string }>> = {
  connected: { light: 'ready', state: 'connected' },
  connecting: { light: 'attention', state: 'connecting' },
  waiting: { light: 'attention', state: 'waiting for the bridge' },
  unpaired: { light: 'attention', state: 'not paired' },
  mismatch: { light: 'attention', state: 'pairing does not match' },
  off: { light: 'off', state: 'off' },
}

/** The header's connection chips: each provider's keys, and the agent link. */
export function connections(status: Status): Connection[] {
  const keyed = (name: string, needs: readonly SecretName[], any = false): Connection => {
    const has = (key: SecretName) => status.stored.includes(key)
    const stored = any ? needs.some(has) : needs.every(has)
    const section = status.vault === 'unlocked' ? 'keys' : 'vault'
    if (!stored) return { name, light: 'off', state: 'not set up', section }
    if (status.vault !== 'unlocked') return { name, light: 'attention', state: 'locked', section }
    return { name, light: 'ready', state: 'ready', section }
  }
  return [
    keyed('DataForSEO', ['dataforseo_login', 'dataforseo_password']),
    keyed('Model', MODEL_KEYS, true),
    { name: 'Agent', ...LINK[status.link], section: 'agent' },
  ]
}
