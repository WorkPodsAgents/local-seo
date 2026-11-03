import { searchUrl } from '@local-seo/core/geo'
import { queryFromUrl, searchPageOf } from '../readers/google-urls'
import { Button } from './components/button'
import { Empty } from './components/notice'

/** On a Google results page, its search (null when it has none); undefined on any other page. */
export function searchPageQuery(url: string | null): string | null | undefined {
  return url === null || searchPageOf(url) === null ? undefined : queryFromUrl(url)
}

/** The same search in Google Maps, or Maps itself when there is no search to carry over. */
export function mapsUrlFor(query: string | null): string {
  return query === null ? 'https://www.google.com/maps' : searchUrl(query)
}

/**
 * Shown on a Google results page in place of a scan or an audit: the local pack and Local Finder
 * readers are not written yet, and the same search in Maps gives the user everything instead.
 */
export function SearchPageNotice({ query }: { readonly query: string | null }) {
  const open = () => void browser.tabs.create({ url: mapsUrlFor(query) })
  return (
    <Empty
      title="Local pack and Local Finder reading is coming"
      action={
        <Button variant="primary" onClick={open}>
          Open in Google Maps
        </Button>
      }
    >
      For now, open the search in Google Maps: Local scan and This business read it there.
    </Empty>
  )
}
