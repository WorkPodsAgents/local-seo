import { describe, expect, it } from 'vitest'
import { analyzePosts } from '../src/posts'
import { NOW, aPost } from './business'

describe('post analytics', () => {
  const posts = [
    aPost({ publishedAt: '2026-10-28T09:00:00Z', text: 'Short' }),
    aPost({
      publishedAt: '2026-10-14T09:00:00Z',
      link: null,
      kind: 'update',
      text: 'A bit longer',
    }),
    aPost({ publishedAt: null, relativeAge: '5 months ago', hasMedia: false, kind: 'event' }),
    aPost({ publishedAt: null, relativeAge: 'il y a 2 mois', kind: 'update' }),
  ]
  const analytics = analyzePosts(posts, NOW)

  it('given posts over months, then the timeline, age and recent counts follow the dates', () => {
    expect(analytics.timeline).toEqual([
      { month: '2026-06', count: 1 },
      { month: '2026-10', count: 2 },
    ])
    expect(analytics.lastPostAgeDays).toBe(5)
    expect([analytics.last30, analytics.last90, analytics.undated]).toEqual([2, 2, 1])
    expect(analytics.medianIntervalDays).toBe(74)
  })

  it('then silences longer than a month are gaps, longest first', () => {
    expect(analytics.gaps).toEqual([{ from: '2026-06-02', to: '2026-10-14', days: 134 }])
  })

  it('then shares, lengths and kinds describe what posts carry', () => {
    expect([analytics.mediaShare, analytics.linkShare]).toEqual([0.75, 0.75])
    expect(analytics.length).toEqual({ min: 5, median: 27, max: 42 })
    expect(analytics.kinds).toEqual({ update: 2, offer: 1, event: 1, unknown: 0 })
  })

  it('given no posts, then the age and shares are null, not zero', () => {
    const none = analyzePosts([], NOW)
    expect([none.lastPostAgeDays, none.last30, none.mediaShare, none.length]).toEqual([
      null,
      null,
      null,
      null,
    ])
  })
})
