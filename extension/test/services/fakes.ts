// A Maps that answers from a table of addresses, and the rest of the services' outside world in
// memory, so the services run in tests without Chrome, Google or a provider.
import type { Business, LocalResults, Post, RankedBusiness, Review } from '@local-seo/core/business'
import type { KeyValueStore } from '@open-agent-ready/core/providers'
import type { LocalDeps } from '../../src/services/deps'
import type { MapsPage } from '../../src/maps/page'
import type { ListStop } from '../../src/readers/paging'
import { createReviewPages } from '../../src/services/review-pages'
import { createSnapshotStore } from '../../src/services/snapshots'

export interface FakeSite {
  readonly place?: Business
  readonly results?: readonly RankedBusiness[]
  readonly reviews?: readonly Review[]
  /** Whether the Reviews tab opens; defaults to whether there are reviews. */
  readonly reviewsTab?: boolean
  /** Whether the Newest sort applies; defaults to true. */
  readonly newestFirst?: boolean
  readonly posts?: readonly Post[]
  readonly stoppedBy?: ListStop
  /** The address the tab ends on, such as one with Maps' view added. */
  readonly landsOn?: string
  readonly blocked?: string
  /** The language Maps draws the page in; defaults to English. */
  readonly language?: string
}

export class FakeMaps implements MapsPage {
  readonly opened: string[] = []
  private current: FakeSite = {}
  private url = ''
  constructor(private readonly site: (url: string) => FakeSite) {}

  async open(url: string) {
    this.opened.push(url)
    this.current = this.site(url)
    this.url = this.current.landsOn ?? url
    return { url: this.url, blocked: this.current.blocked ?? null }
  }
  async currentUrl() {
    return this.url
  }
  async read(type: string): Promise<never> {
    const site = this.current
    const stoppedBy = site.stoppedBy ?? 'end'
    const answers: Record<string, unknown> = {
      'maps:readPlace': site.place ?? null,
      'maps:readResults':
        site.results === undefined ? null : { results: list(site.results), stoppedBy },
      'maps:openReviews': site.reviewsTab ?? site.reviews !== undefined,
      'maps:sortReviews': site.newestFirst ?? true,
      'maps:readReviews': { items: site.reviews ?? [], stoppedBy },
      'maps:readPosts': { items: site.posts ?? [], stoppedBy },
      'maps:language': { language: site.language ?? 'en' },
    }
    return answers[type] as never
  }
  async wait() {}
}

function list(results: readonly RankedBusiness[]): LocalResults {
  return { surface: 'maps', query: 'q', from: null, readAt: '2026-11-02T12:00:00Z', results }
}

export function memoryStore(): KeyValueStore & { readonly data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
  }
}

export function ranked(position: number, name: string, cid: string): RankedBusiness {
  return {
    position,
    sponsored: false,
    name,
    ids: { placeId: null, cid, kgId: null, featureId: null },
    primaryCategory: 'Plumber',
    rating: 4.5,
    reviewCount: 40,
    address: null,
    location: null,
  }
}

/** Deps whose every outside call fails loudly unless the test replaces it. */
export function fakeDeps(page: MapsPage, changes: Partial<LocalDeps> = {}): LocalDeps {
  const unused = (what: string) => () => {
    throw new Error(`${what} was not expected in this test`)
  }
  let id = 0
  return {
    maps: (work) => work(page),
    snapshots: createSnapshotStore(memoryStore()),
    reviewPages: createReviewPages(
      memoryStore(),
      () => 0,
      () => `c${(id += 1)}`,
    ),
    dataForSeo: {
      reviews: unused('DataForSEO reviews'),
      posts: unused('DataForSEO posts'),
      mapsAt: unused('DataForSEO Maps'),
    },
    keywordVolumes: unused('keyword volumes'),
    hasDataForSeo: async () => false,
    paidBlock: async () => null,
    paid: (call) => call(),
    website: unused('website'),
    answers: unused('answers'),
    now: () => new Date('2026-11-02T12:00:00Z'),
    sleep: async () => undefined,
    gridPauseMs: 4000,
    gridStopped: () => false,
    onGridProgress: () => undefined,
    ...changes,
  }
}
