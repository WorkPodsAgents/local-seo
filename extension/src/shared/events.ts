import type { EventName, Events, PanelEvent } from './api'

/**
 * Tells any open panel or report tab. With none open there is nobody to tell, so the failed
 * send is dropped. Reaching the service worker too keeps it awake through a long scan.
 */
export function emit<E extends EventName>(event: E, data: Events[E]): void {
  const message: PanelEvent = { target: 'panel', event, data }
  browser.runtime.sendMessage(message).catch(() => undefined)
}
