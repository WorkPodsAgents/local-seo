// The seams the paid-provider code needs from its runtime. The extension backs KeyValueStore with
// chrome.storage.local or IndexedDB; tests back it with a Map. The clock is injected so a month
// rollover or a cache expiry can be tested without waiting.

/** A persistent store of JSON-serialisable values. `get` resolves undefined for a missing key. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}

/** Milliseconds since the epoch. */
export type Clock = () => number

/**
 * Runs each task after the previous one settles. Read-modify-write on a KeyValueStore is not
 * atomic, so two calls in flight at once would otherwise lose one write.
 */
export function serialized(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task)
    tail = run.catch(() => undefined)
    return run
  }
}
