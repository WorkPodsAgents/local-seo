// The KeyValueStore seams core's vault, spend ledger and response cache need, backed by the
// extension's storage. Small records go to chrome.storage.local; cached answers, which can be
// large, go to IndexedDB.
import type { KeyValueStore } from '@open-agent-ready/core/providers'
import { idbClear, idbDelete, idbGet, idbSet } from './idb'

export const localStore: KeyValueStore = {
  async get(key) {
    if (import.meta.env.FIREFOX) return idbGet('private', key)
    return (await browser.storage.local.get(key))[key]
  },
  async set(key, value) {
    if (import.meta.env.FIREFOX) {
      await idbSet('private', key, value)
      void browser.runtime.sendMessage({ target: 'private-storage', key }).catch(() => undefined)
    } else await browser.storage.local.set({ [key]: value })
  },
  remove: (key) =>
    import.meta.env.FIREFOX ? idbDelete('private', key) : browser.storage.local.remove(key),
}

export const cacheStore: KeyValueStore = {
  get: (key) => idbGet('cache', key),
  set: (key, value) => idbSet('cache', key, value),
  remove: (key) => idbDelete('cache', key),
}

/** Firefox has no storage access-level API, so private records use extension-origin IndexedDB. */
export async function clearLocalStore(): Promise<void> {
  if (import.meta.env.FIREFOX) await idbClear('private')
  else await browser.storage.local.clear()
}
