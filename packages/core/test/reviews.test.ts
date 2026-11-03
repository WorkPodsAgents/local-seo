import { describe, expect, it } from 'vitest'
import { resolveRelativeAge } from '../src/business'
import { analyzeReviews } from '../src/reviews'
import { NOW, aReview } from './business'

describe('relative review ages', () => {
  it('given English ages, then each resolves to a date counted back from now', () => {
    expect(resolveRelativeAge('3 weeks ago', NOW)).toBe('2026-10-12')
    expect(resolveRelativeAge('a year ago', NOW)).toBe('2025-11-02')
    expect(resolveRelativeAge('11 months ago', NOW)).toBe('2025-12-02')
    expect(resolveRelativeAge('an hour ago', NOW)).toBe('2026-11-02')
    expect(resolveRelativeAge('Edited 2 days ago', NOW)).toBe('2026-10-31')
    const lastOfMarch = new Date('2026-03-31T10:00:00Z')
    expect(resolveRelativeAge('a month ago', lastOfMarch)).toBe('2026-02-28')
    expect(resolveRelativeAge('a year ago', new Date('2028-02-29T10:00:00Z'))).toBe('2027-02-28')
  })

  it('given another language or a date-like text, then it is null rather than a guess', () => {
    expect(resolveRelativeAge('vor 3 Wochen', NOW)).toBeNull()
    expect(resolveRelativeAge('il y a un an', NOW)).toBeNull()
    expect(resolveRelativeAge('recently', NOW)).toBeNull()
  })
})

describe('review analytics', () => {
  const reviews = [
    aReview({
      id: 'a',
      rating: 5,
      text: 'Great customer service and fair price.',
      publishedAt: '2026-10-25T00:00:00Z',
      ownerReply: { text: 'Thanks', publishedAt: '2026-10-27T00:00:00Z' },
    }),
    aReview({
      id: 'b',
      rating: 4,
      text: 'Good customer service, fair price too.',
      publishedAt: null,
      relativeAge: '2 months ago',
      ownerReply: { text: 'Thanks', publishedAt: null },
    }),
    aReview({
      id: 'c',
      rating: 1,
      text: 'Rude on the phone. The customer service was poor.',
      publishedAt: '2026-06-01T00:00:00Z',
      ownerReply: null,
      photoCount: 2,
    }),
    aReview({
      id: 'd',
      rating: 5,
      text: null,
      publishedAt: null,
      relativeAge: 'vor einem Jahr',
      ownerReply: null,
    }),
  ]
  const analytics = analyzeReviews(reviews, NOW)

  it('given dated and relative reviews, then velocity counts only those with a known date', () => {
    expect(analytics.velocity).toEqual({ last30: 1, last90: 2, last365: 3 })
    expect(analytics.undated).toBe(1)
    expect(analytics.monthly.map((month) => month.month)).toEqual(['2026-06', '2026-09', '2026-10'])
  })

  it('then the rating, its distribution and the photo share come from every review read', () => {
    expect(analytics.averageRating).toBe(3.75)
    expect(analytics.distribution).toEqual([1, 0, 0, 1, 2])
    expect(analytics.photoShare).toBe(0.25)
  })

  it('then the response rate counts every reply and the delay only those with both dates', () => {
    expect(analytics.responses).toEqual({
      replied: 2,
      total: 4,
      rate: 0.5,
      medianReplyDays: 2,
      timedReplies: 1,
    })
    expect(analytics.unansweredNegatives).toEqual([
      {
        id: 'c',
        rating: 1,
        date: '2026-06-01',
        excerpt: 'Rude on the phone. The customer service was poor.',
      },
    ])
  })

  it('then themes are phrases at least two reviews share, with example review ids', () => {
    expect(analytics.themes.slice(0, 3)).toEqual([
      { phrase: 'customer service', count: 3, reviewIds: ['a', 'b', 'c'] },
      { phrase: 'customer', count: 3, reviewIds: ['a', 'b', 'c'] },
      { phrase: 'service', count: 3, reviewIds: ['a', 'b', 'c'] },
    ])
    expect(analytics.themes.map((theme) => theme.phrase)).toContain('fair price')
    expect(analytics.themes.map((theme) => theme.phrase)).not.toContain('rude')
  })

  it('given no reviews, then rates are null, not zero', () => {
    const empty = analyzeReviews([], NOW)
    expect([empty.averageRating, empty.velocity, empty.responses.rate]).toEqual([null, null, null])
  })
})
