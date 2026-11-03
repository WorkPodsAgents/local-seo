// Saved results, cached provider answers and the remember-on-device key live in IndexedDB, which
// holds far more than chrome.storage.local and stores a CryptoKey as it is.

/** results: saved audits and snapshots. cache: paid answers. device: the vault key. */
export type IdbStore = 'results' | 'cache' | 'device' | 'private'

const STORES: readonly IdbStore[] = ['results', 'cache', 'device', 'private']

let opening: Promise<IDBDatabase> | null = null

function database(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('local-seo', 2)
    request.onupgradeneeded = () => {
      for (const store of STORES) {
        if (!request.result.objectStoreNames.contains(store))
          request.result.createObjectStore(store)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB did not open'))
  })
  return opening
}

async function run<T>(
  store: IdbStore,
  mode: IDBTransactionMode,
  action: (objects: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(store, mode).objectStore(store))
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function idbGet<T>(store: IdbStore, key: string): Promise<T | undefined> {
  return run<T | undefined>(store, 'readonly', (objects) => objects.get(key))
}

export async function idbSet(store: IdbStore, key: string, value: unknown): Promise<void> {
  await run(store, 'readwrite', (objects) => objects.put(value, key))
}

export async function idbDelete(store: IdbStore, key: string): Promise<void> {
  await run(store, 'readwrite', (objects) => objects.delete(key))
}

export async function idbClear(store: IdbStore): Promise<void> {
  await run(store, 'readwrite', (objects) => objects.clear())
}
