import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalStore, localStore } from '../../src/background/stores'

const exposedStorage = new Map<string, unknown>()
const storage = {
  get: vi.fn(async (key: string) => ({ [key]: exposedStorage.get(key) })),
  set: vi.fn(async (items: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(items)) exposedStorage.set(key, value)
  }),
  remove: vi.fn(async (key: string) => {
    exposedStorage.delete(key)
  }),
  clear: vi.fn(async () => {
    exposedStorage.clear()
  }),
}

beforeEach(() => {
  vi.stubGlobal('browser', {
    storage: { local: storage },
    runtime: { sendMessage: vi.fn(async () => undefined) },
  })
  exposedStorage.clear()
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Firefox private records', () => {
  it('keeps vault and ledger records outside the storage API exposed to content scripts', async () => {
    vi.stubEnv('FIREFOX', 'true')
    await clearLocalStore()
    await localStore.set('vault', { encrypted: 'ciphertext' })
    await localStore.set('spend', { usd: 5 })
    expect(await localStore.get('vault')).toEqual({ encrypted: 'ciphertext' })
    expect(await localStore.get('spend')).toEqual({ usd: 5 })
    expect(await storage.get('vault')).toEqual({ vault: undefined })
    expect(storage.set).not.toHaveBeenCalled()
    await clearLocalStore()
    expect(await localStore.get('vault')).toBeUndefined()
    expect(await localStore.get('spend')).toBeUndefined()
  })
  it('deletes a private record without removing unrelated records', async () => {
    vi.stubEnv('FIREFOX', 'true')
    await localStore.set('history', ['one'])
    await localStore.set('settings', { agentLink: false })
    await localStore.remove('history')
    expect(await localStore.get('history')).toBeUndefined()
    expect(await localStore.get('settings')).toEqual({ agentLink: false })
    await clearLocalStore()
  })
})

it('continues to use restricted browser storage for Chrome records', async () => {
  vi.stubEnv('FIREFOX', '')
  await localStore.set('settings', { agentLink: true })
  expect(await localStore.get('settings')).toEqual({ agentLink: true })
  expect(storage.set).toHaveBeenCalledWith({ settings: { agentLink: true } })
  await clearLocalStore()
  expect(await localStore.get('settings')).toBeUndefined()
})
