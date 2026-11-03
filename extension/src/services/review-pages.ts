// read_reviews answers in pages of LIMITS.reviews.page. The whole read is kept for half an hour
// under an opaque cursor, so an agent pages through 500 reviews without Maps being scrolled (or
// DataForSEO paid) again. Session storage survives the service worker sleeping between calls.
import { LIMITS, type ReadReviewsResult } from '@local-seo/core/bridge'
import type { KeyValueStore } from '@open-agent-ready/core/providers'

export const CURSOR_TTL_MS = 30 * 60_000

interface Kept {
  readonly result: Omit<ReadReviewsResult, 'nextCursor'>
  readonly expires: number
}

export interface ReviewPages {
  /** The first page of a fresh read, keeping the rest for its cursor. */
  first(result: Omit<ReadReviewsResult, 'nextCursor'>): Promise<ReadReviewsResult>
  /** The page a cursor points to; throws when it expired or never existed. */
  next(cursor: string): Promise<ReadReviewsResult>
}

export function createReviewPages(
  store: KeyValueStore,
  clock: () => number,
  newId: () => string,
): ReviewPages {
  const page = async (id: string, kept: Kept, offset: number): Promise<ReadReviewsResult> => {
    const end = offset + LIMITS.reviews.page
    const more = end < kept.result.reviews.length
    return {
      ...kept.result,
      reviews: kept.result.reviews.slice(offset, end),
      nextCursor: more ? `${id}.${end}` : null,
      // The spend was reported with the first page; later pages cost nothing more.
      spend: offset === 0 ? kept.result.spend : null,
    }
  }
  return {
    async first(result) {
      const id = newId()
      const kept = { result, expires: clock() + CURSOR_TTL_MS }
      if (result.reviews.length > LIMITS.reviews.page) await store.set(`reviews:${id}`, kept)
      return page(id, kept, 0)
    },
    async next(cursor) {
      const [id = '', offsetText = ''] = cursor.split('.')
      const kept = (await store.get(`reviews:${id}`)) as Kept | undefined
      const offset = Number(offsetText)
      if (kept !== undefined && kept.expires < clock()) await store.remove(`reviews:${id}`)
      if (kept === undefined || kept.expires < clock() || !Number.isInteger(offset)) {
        throw new Error(
          'That cursor has expired or is unknown. Call read_reviews again without a cursor.',
        )
      }
      return page(id, kept, offset)
    },
  }
}
