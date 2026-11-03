import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Status } from '../shared/settings'
import { call, useEvent } from './client'

const StatusContext = createContext<{
  readonly status: Status | null
  readonly setStatus: (status: Status) => void
}>({ status: null, setStatus: () => undefined })

/** The vault, link, spend and settings state every tab reads, kept fresh by the worker. */
export function StatusProvider({ children }: { readonly children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null)
  useEffect(() => {
    void call('status', {}).then(setStatus)
  }, [])
  useEvent('status', setStatus)
  return <StatusContext value={{ status, setStatus }}>{children}</StatusContext>
}

export function useStatus() {
  return useContext(StatusContext)
}
