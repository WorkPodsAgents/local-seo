import type { Browser } from 'wxt/browser'
import type { Api, ApiType } from '../shared/api'
import { registerHandler } from './router'

/**
 * Registers a panel handler. Content scripts share the message channel and run inside pages the
 * extension does not trust, so only the extension's own pages (and the bridge link, which calls
 * the router directly with no sender) may reach these handlers.
 */
export function handle<K extends ApiType>(
  type: K,
  handler: (payload: Api[K]['in']) => Promise<Api[K]['out']>,
): void {
  registerHandler(type, (payload, sender) => {
    if (!fromExtensionPage(sender)) throw new Error(`${type} is only open to the extension`)
    // The sender is the extension's own page, built against the same Api map.
    return handler(payload as Api[K]['in'])
  })
}

function fromExtensionPage(sender: Browser.runtime.MessageSender | null): boolean {
  if (sender === null) return true
  return sender.url?.startsWith(browser.runtime.getURL('/')) === true
}
