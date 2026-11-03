// Loads a saved Maps page from test/fixtures/maps with the address it was saved from, which each
// file keeps in its first line so a page and its URL cannot drift apart.
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'

export interface SavedPage {
  readonly document: Document
  readonly url: string
}

export function savedMapsPage(name: string): SavedPage {
  const html = readFileSync(new URL(`../fixtures/maps/${name}.html`, import.meta.url), 'utf8')
  const url = /^<!-- source: (\S+) -->/.exec(html)?.[1]
  if (url === undefined) throw new Error(`${name}.html does not start with its source address`)
  return { document: parseHTML(html).document, url }
}

export interface SavedPlaceData {
  /** The request address, which carries the place's feature id. */
  readonly source: string
  /** The response body as Maps sent it, `)]}'` prefix included. */
  readonly body: string
}

/** The `/maps/preview/place` response Maps fetched for South Austin Dentist. */
export function savedPlaceData(): SavedPlaceData {
  const file = new URL('../fixtures/maps/preview-place-dentist-austin.json', import.meta.url)
  return JSON.parse(readFileSync(file, 'utf8')) as SavedPlaceData
}
