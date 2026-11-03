import { useEffect, useRef } from 'react'
import type { Api, ApiReply, ApiType, EventName, Events, PanelEvent } from '../shared/api'
import { SITE_PERMISSIONS, sitePattern } from '../shared/host'

/**
 * Demo mode (development and e2e builds only) answers the panel from saved fixtures instead of
 * the service worker, so every screen can be rendered and photographed without visiting Google.
 */
export interface Demo {
  readonly answer: (type: string, payload: unknown) => Promise<unknown>
  readonly tab: { readonly id: number; readonly url: string }
}

let demo: Demo | null = null
const demoListeners = new Set<(event: EventName, data: unknown) => void>()

export function startDemo(next: Demo): void {
  demo = next
}

export function demoTab(): Demo['tab'] | null {
  return demo?.tab ?? null
}

/** Sends a demo event to the panel, as the service worker's emit would. */
export function emitDemo<E extends EventName>(event: E, data: Events[E]): void {
  for (const listener of demoListeners) listener(event, data)
}

/** Sends one request to the service worker and returns its answer, or throws its message. */
export async function call<K extends ApiType>(
  type: K,
  payload: Api[K]['in'],
): Promise<Api[K]['out']> {
  // The demo answers each type with fixture data of the same Api shape.
  if (demo !== null) return (await demo.answer(type, payload)) as Api[K]['out']
  const reply = (await browser.runtime.sendMessage({ type, payload })) as ApiReply | undefined
  if (reply === undefined) throw new Error('The extension did not answer. Reload it and try again.')
  if (!reply.ok) throw new Error(reply.error)
  // The service worker answers each type from the same Api map.
  return reply.result as Api[K]['out']
}

export function useEvent<E extends EventName>(event: E, listener: (data: Events[E]) => void) {
  const latest = useRef(listener)
  latest.current = listener
  useEffect(() => {
    const onMessage = (message: unknown) => {
      const panelEvent = message as Partial<PanelEvent>
      if (panelEvent.target !== 'panel' || panelEvent.event !== event) return
      latest.current(panelEvent.data as Events[E])
    }
    if (demo !== null) {
      const onDemo = (name: EventName, data: unknown) => {
        if (name === event) latest.current(data as Events[E])
      }
      demoListeners.add(onDemo)
      return () => void demoListeners.delete(onDemo)
    }
    browser.runtime.onMessage.addListener(onMessage)
    return () => browser.runtime.onMessage.removeListener(onMessage)
  }, [event])
}

/**
 * Asks for access to the sites a check will read. It must run first in a click handler: Chrome
 * shows the prompt only during the user's gesture.
 */
export async function grantSites(...urls: string[]): Promise<void> {
  if (demo !== null) return
  const origins = [...new Set(urls.map(sitePattern))]
  if (await browser.permissions.request({ permissions: [...SITE_PERMISSIONS], origins })) return
  throw new Error('The check needs access to the site to read it. Allow it to continue.')
}

/** Asks for exact origins, such as the assistants Assist mode opens; from a click only. */
export async function grantOrigins(origins: readonly string[]): Promise<boolean> {
  if (demo !== null) return true
  return browser.permissions.request({ origins: [...origins] })
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
