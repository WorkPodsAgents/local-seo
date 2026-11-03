import type { Browser } from 'wxt/browser'

// One message router for the service worker. The side panel, content scripts and the bridge link
// all send `{ type, payload }`; each feature registers its handlers here at startup.

export type Handler = (
  payload: unknown,
  sender: Browser.runtime.MessageSender | null,
) => Promise<unknown>

const handlers = new Map<string, Handler>()

export function registerHandler(type: string, handler: Handler): void {
  if (handlers.has(type)) throw new Error(`handler already registered: ${type}`)
  handlers.set(type, handler)
}

export async function dispatch(
  type: string,
  payload: unknown,
  sender: Browser.runtime.MessageSender | null,
): Promise<unknown> {
  const handler = handlers.get(type)
  if (handler === undefined) throw new Error(`no handler for ${type}`)
  return handler(payload, sender)
}
