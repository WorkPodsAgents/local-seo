import { describe, expect, it } from 'vitest'
import { aBusiness, aReview } from '../../../packages/core/test/business'
import { analyzeReviews } from '@local-seo/core/reviews'
import { createReviewPages, CURSOR_TTL_MS } from '../../src/services/review-pages'
import { createSnapshotStore } from '../../src/services/snapshots'
import { memoryStore } from './fakes'

const ids = { placeId: 'ChIJtarget', cid: '111', kgId: null, featureId: null }

describe('profile snapshots', () => {
  it('given a renamed profile on the next read, then the change is reported', async () => {
    const store = createSnapshotStore(memoryStore())
    const first = await store.save(aBusiness({ ids, readAt: '2026-10-01T00:00:00Z' }))
    expect(first).toEqual({ previous: null, changes: [] })
    const second = await store.save(
      aBusiness({ ids, name: 'Nyack Plumbing 24/7', readAt: '2026-10-08T00:00:00Z' }),
    )
    expect(second.previous?.readAt).toBe('2026-10-01T00:00:00Z')
    expect(second.changes.map((change) => change.field)).toEqual(['name'])
    // Found again by any of its ids, oldest first.
    const history = await store.history({ placeId: 'ChIJtarget' })
    expect(history.map((entry) => entry.business.name)).toEqual([
      'Nyack Plumbing Co',
      'Nyack Plumbing 24/7',
    ])
  })

  it('a read that changes nothing adds no snapshot', async () => {
    const store = createSnapshotStore(memoryStore())
    await store.save(aBusiness({ ids }))
    await store.save(aBusiness({ ids, readAt: '2026-11-03T00:00:00Z' }))
    expect(await store.history({ cid: '111' })).toHaveLength(1)
    expect(await store.history({ cid: '999' })).toEqual([])
  })

  it('two places with one name keep separate histories', async () => {
    const store = createSnapshotStore(memoryStore())
    await store.save(aBusiness({ ids }))
    await store.save(aBusiness({ ids: { ...ids, cid: '222', placeId: null } }))
    expect(await store.history({ cid: '111' })).toHaveLength(1)
    expect(await store.history({ cid: '222' })).toHaveLength(1)
  })
})

describe('review pages', () => {
  const now = new Date('2026-11-02T12:00:00Z')
  const reviews = Array.from({ length: 250 }, (_, at) => aReview({ id: `r${at}` }))
  const read = {
    business: {
      name: 'Nyack Plumbing Co',
      source: 'maps_page' as const,
      readAt: now.toISOString(),
      placeId: null,
      cid: '111',
      primaryCategory: 'Plumber',
      address: null,
      phone: null,
      website: null,
      rating: 4.6,
      reviewCount: 300,
    },
    reviews,
    analytics: analyzeReviews(reviews, now),
    read: 250,
    order: 'newest' as const,
    truncated: true,
    notes: [],
    spend: { usd: 0.0375, cached: false },
  }

  it('pages a long read by cursor, reporting the spend once', async () => {
    let clock = 0
    const pages = createReviewPages(
      memoryStore(),
      () => clock,
      () => 'abc',
    )
    const first = await pages.first(read)
    expect(first.reviews).toHaveLength(100)
    expect(first.spend?.usd).toBe(0.0375)
    expect(first.nextCursor).not.toBeNull()
    const second = await pages.next(first.nextCursor ?? '')
    expect(second.reviews[0]?.id).toBe('r100')
    expect(second.spend).toBeNull()
    const third = await pages.next(second.nextCursor ?? '')
    expect(third.reviews).toHaveLength(50)
    expect(third.nextCursor).toBeNull()
    clock = CURSOR_TTL_MS + 1
    await expect(pages.next(first.nextCursor ?? '')).rejects.toThrow('expired')
  })
})
