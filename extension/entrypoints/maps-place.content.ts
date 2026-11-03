import { installPlaceHook } from '../src/readers/maps/place-hook'

// Keeps the place data Maps fetches, for the Maps reader (see place-hook.ts for why it runs in
// the page's world). It is declared in the manifest, unlike the readers, because it must be in
// place before Maps sends its first request; it reads nothing until the reader asks.
export default defineContentScript({
  matches: ['https://www.google.com/maps/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installPlaceHook(window)
  },
})
