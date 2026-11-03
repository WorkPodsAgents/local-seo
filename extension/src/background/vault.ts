// The one vault the service worker holds. Secrets are decrypted here and passed straight to a
// provider call; no handler returns one, so they never reach a page, a content script, the
// bridge or an export.
import {
  createVault,
  type DeviceKeyStore,
  type SessionKeyStore,
} from '@open-agent-ready/core/secrets'
import { idbDelete, idbGet, idbSet } from './idb'
import { localStore } from './stores'

const SESSION_KEY = 'vault-session-key'
const DEVICE_KEY = 'vault-key'

// chrome.storage.session is memory only and cleared when the browser closes; it is closed to
// content scripts by default.
const sessionKeyStore: SessionKeyStore = {
  async get() {
    const stored = (await browser.storage.session.get(SESSION_KEY))[SESSION_KEY]
    return Array.isArray(stored) ? Uint8Array.from(stored as number[]) : null
  },
  set: (rawKey) => browser.storage.session.set({ [SESSION_KEY]: Array.from(rawKey) }),
  clear: () => browser.storage.session.remove(SESSION_KEY),
}

const deviceKeyStore: DeviceKeyStore = {
  async get() {
    return (await idbGet<CryptoKey>('device', DEVICE_KEY)) ?? null
  },
  set: (key) => idbSet('device', DEVICE_KEY, key),
  clear: () => idbDelete('device', DEVICE_KEY),
}

export const vault = createVault({ storage: localStore, sessionKeyStore, deviceKeyStore })

export async function isRemembered(): Promise<boolean> {
  return (await deviceKeyStore.get()) !== null
}

/**
 * Content scripts can read chrome.storage.local unless it is limited to trusted contexts. The
 * vault record is encrypted, but the spend ledger and settings are still nobody's business.
 */
export async function closeStorageToPages(): Promise<void> {
  // Firefox private records use extension-origin IndexedDB, outside content-script storage.
  if (import.meta.env.FIREFOX) return
  await browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
}
