import { extensionFetcher } from './fetcher'
import { handle } from './handle'

/** Requests the panel's checks make, sent from here, where redirect hops are visible. */
export function registerNetHandlers(): void {
  handle('net:fetch', (request) => extensionFetcher.fetch(request))
}
