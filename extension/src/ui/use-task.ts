import { useCallback, useState } from 'react'
import { errorText } from './client'

export type Task<T> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly previous: T | null }
  | { readonly kind: 'done'; readonly value: T }
  | { readonly kind: 'failed'; readonly error: string; readonly previous: T | null }

/** One async action a screen runs on demand, with its last result kept while it reruns. */
export function useTask<T>(initial: T | null = null) {
  const [task, setTask] = useState<Task<T>>(
    initial === null ? { kind: 'idle' } : { kind: 'done', value: initial },
  )
  const run = useCallback(async (work: () => Promise<T>) => {
    setTask((current) => ({ kind: 'running', previous: valueOf(current) }))
    try {
      const value = await work()
      setTask({ kind: 'done', value })
    } catch (error) {
      setTask((current) => ({
        kind: 'failed',
        error: errorText(error),
        previous: valueOf(current),
      }))
    }
  }, [])
  return { task, run, value: valueOf(task), setTask }
}

export function valueOf<T>(task: Task<T>): T | null {
  switch (task.kind) {
    case 'idle':
      return null
    case 'done':
      return task.value
    case 'running':
    case 'failed':
      return task.previous
  }
}
