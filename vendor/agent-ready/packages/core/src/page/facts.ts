// What a crawl keeps of a page: enough for the cross-page checks without holding its Document.
import type { PageFacts, PageSnapshot } from '../model'
import { fnv1a64 } from './hash'
import { readPage } from './read'

export function factsOf(snapshot: PageSnapshot): PageFacts {
  const page = readPage(snapshot)
  const { shown } = page
  return {
    url: snapshot.url,
    status: snapshot.status,
    redirects: snapshot.redirects,
    contentType: snapshot.headers['content-type'] ?? null,
    title: shown.head.title,
    metaDescription: shown.head.description,
    h1s: shown.h1s,
    canonical: page.canonical,
    noindex: page.noindex,
    links: shown.links,
    hreflang: page.hreflang,
    wordCount: shown.words,
    // Lower-cased, as WorkPods hashes it, so a change of case alone is no new content.
    textHash: fnv1a64(shown.text.toLowerCase()),
  }
}
