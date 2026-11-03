// Paid responses kept on the device, so asking the same question within the window costs nothing.
// The key is the provider, the endpoint and the request body with its object keys sorted and its
// strings trimmed and lower-cased, so `{"keywords":["Shoes "]}` and `{"keywords":["shoes"]}`
// share an answer. Keys are SHA-256 digests, which keeps them short and keeps request text
// (domains, prompts) out of storage key names.
import type { Provider } from './failure'
import type { Clock, KeyValueStore } from './store'

export const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface ResponseCache {
  /** The stored response, or undefined when there is none inside the window. */
  get(provider: Provider, endpoint: string, body: unknown): Promise<unknown>
  put(provider: Provider, endpoint: string, body: unknown, response: unknown): Promise<void>
}

export function createResponseCache(deps: {
  readonly storage: KeyValueStore
  readonly clock: Clock
  readonly ttlMs?: number
}): ResponseCache {
  const ttl = deps.ttlMs ?? DEFAULT_CACHE_TTL_MS
  return {
    async get(provider, endpoint, body) {
      const key = await cacheKey(provider, endpoint, body)
      const entry = await deps.storage.get(key)
      if (typeof entry !== 'object' || entry === null) return undefined
      const { storedAt, response } = entry as Record<string, unknown>
      if (typeof storedAt === 'number' && deps.clock() - storedAt < ttl) return response
      await deps.storage.remove(key)
      return undefined
    },
    async put(provider, endpoint, body, response) {
      const key = await cacheKey(provider, endpoint, body)
      await deps.storage.set(key, { storedAt: deps.clock(), response })
    },
  }
}

async function cacheKey(provider: Provider, endpoint: string, body: unknown): Promise<string> {
  const text = `${provider} ${endpoint} ${JSON.stringify(normalised(body))}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
  return `cache:${hex.join('')}`
}

function normalised(value: unknown): unknown {
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (Array.isArray(value)) return value.map(normalised)
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(entries.map(([key, inner]) => [key, normalised(inner)]))
  }
  return value
}
