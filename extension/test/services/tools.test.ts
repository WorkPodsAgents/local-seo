import { beforeAll, describe, expect, it } from 'vitest'
import type { ToolName } from '@local-seo/core/bridge'
import { aBusiness, aReview } from '../../../packages/core/test/business'
import { registerTools } from '../../src/background/tools'
import { dispatch } from '../../src/background/router'
import type { LocalDeps } from '../../src/services/deps'
import { createLocalTools } from '../../src/services/tools'
import { fakeDeps, FakeMaps, ranked } from './fakes'

const business = aBusiness({
  ids: { placeId: null, cid: '111', kgId: null, featureId: null },
  reviewCount: 300,
})
const reviews = Array.from({ length: 130 }, (_, at) => aReview({ id: `r${at}`, rating: 5 }))

const maps = new FakeMaps((url) => {
  if (url.includes('/search/')) {
    return { results: [ranked(1, 'Rockland Rooter', '9'), ranked(2, 'Nyack Plumbing Co', '111')] }
  }
  return { place: business, reviews, stoppedBy: 'want' }
})

// Each test sets what the outside world does; the router keeps the handlers registered once.
let deps: LocalDeps = fakeDeps(maps)
const live: LocalDeps = new Proxy({} as LocalDeps, {
  get: (_, key) => deps[key as keyof LocalDeps],
})

beforeAll(() => registerTools(createLocalTools(live), () => undefined))

const call = (name: ToolName, args: unknown) => dispatch(`tool:${name}`, args, null)

describe('tool handlers through the router', () => {
  it('refuses a call that comes from a page or content script', async () => {
    const sender = { url: 'https://evil.example/' }
    await expect(
      dispatch('tool:profile_history', { business: { cid: '1' } }, sender),
    ).rejects.toThrow('only open to the agent bridge')
  })

  it('a grid estimate prices the whole grid and reads nothing', async () => {
    deps = fakeDeps(maps)
    const opened = maps.opened.length
    const result = await call('geo_grid', {
      query: 'plumber',
      business: { cid: '111' },
      center: { lat: 41.1, lng: -74 },
      size: 7,
      spacingKm: 1,
      source: 'dataforseo',
      estimateOnly: true,
    })
    expect(result).toMatchObject({ cells: [], summary: null, spend: null })
    expect((result as { estimatedCostUsd: number }).estimatedCostUsd).toBeCloseTo(49 * 0.002)
    expect(maps.opened.length).toBe(opened)
  })

  it('a paid grid over the cap is refused before any point is bought', async () => {
    deps = fakeDeps(maps, { paidBlock: async () => "Over this month's cap." })
    await expect(
      call('geo_grid', {
        query: 'plumber',
        business: { cid: '111' },
        center: { lat: 41.1, lng: -74 },
        size: 5,
        spacingKm: 1,
        source: 'dataforseo',
      }),
    ).rejects.toThrow("Over this month's cap.")
  })

  it('a paid grid whose every point failed reports nothing cached', async () => {
    deps = fakeDeps(maps, {
      dataForSeo: {
        ...fakeDeps(maps).dataForSeo,
        mapsAt: async () => Promise.reject(new Error('DataForSEO is not answering right now.')),
      },
    })
    const result = await call('geo_grid', {
      query: 'plumber',
      business: { cid: '111' },
      center: { lat: 41.1, lng: -74 },
      size: 3,
      spacingKm: 1,
      source: 'dataforseo',
    })
    expect(result).toMatchObject({ spend: { usd: 0, cached: false } })
  })

  it('a browser grid larger than 5x5 is refused', async () => {
    deps = fakeDeps(maps)
    await expect(
      call('geo_grid', {
        query: 'plumber',
        business: { cid: '111' },
        center: { lat: 41.1, lng: -74 },
        size: 7,
        spacingKm: 1,
      }),
    ).rejects.toThrow('at most 5x5')
  })

  it('a browser grid ranks the business at every point and summarises it', async () => {
    deps = fakeDeps(maps)
    const result = (await call('geo_grid', {
      query: 'plumber',
      business: { cid: '111' },
      center: { lat: 41.1, lng: -74 },
      size: 3,
      spacingKm: 1,
    })) as { summary: { ranked: number; averageRank: number }; estimatedCostUsd: null }
    expect(result.summary).toMatchObject({ ranked: 9, averageRank: 2 })
    expect(result.estimatedCostUsd).toBeNull()
  })

  it('reads reviews in pages and says the read stopped short of the profile', async () => {
    deps = fakeDeps(maps)
    const first = (await call('read_reviews', { business: { cid: '111' }, max: 130 })) as {
      reviews: unknown[]
      read: number
      truncated: boolean
      nextCursor: string
    }
    expect(first).toMatchObject({ read: 130, truncated: true })
    expect(first.reviews).toHaveLength(100)
    const next = (await call('read_reviews', {
      business: { cid: '111' },
      cursor: first.nextCursor,
    })) as { reviews: unknown[]; nextCursor: string | null }
    expect(next.reviews).toHaveLength(30)
    expect(next.nextCursor).toBeNull()
  })

  it('rank_at finds the business in the results at the point', async () => {
    deps = fakeDeps(maps)
    const result = await call('rank_at', {
      query: 'plumber',
      business: { cid: '111' },
      at: { lat: 41.1, lng: -74 },
    })
    expect(result).toMatchObject({ zoom: 14, rank: { kind: 'ranked', rank: 2 } })
  })

  it('rank_at counts the depth in organic positions, so ads never hide a rank', async () => {
    const ad = (position: number) => ({
      ...ranked(position, `Ad ${position}`, `ad${position}`),
      sponsored: true,
    })
    const organic = Array.from({ length: 20 }, (_, at) =>
      ranked(at + 1, at === 19 ? 'Nyack Plumbing Co' : `Other ${at}`, at === 19 ? '111' : `o${at}`),
    )
    deps = fakeDeps(
      new FakeMaps((url) =>
        url.includes('/search/')
          ? { results: [ad(1), ad(2), ...organic] }
          : { place: business, reviews, stoppedBy: 'want' },
      ),
    )
    const result = await call('rank_at', {
      query: 'plumber',
      business: { cid: '111' },
      at: { lat: 41.1, lng: -74 },
    })
    expect(result).toMatchObject({ rank: { kind: 'ranked', rank: 20 } })
  })

  it('profile_history lists what earlier reads saved, without reading Google', async () => {
    deps = fakeDeps(maps)
    await call('rank_at', { query: 'plumber', business: { cid: '111' }, at: { lat: 1, lng: 1 } })
    const opened = maps.opened.length
    const history = (await call('profile_history', { business: { cid: '111' } })) as {
      snapshots: { summary: { name: string } }[]
    }
    expect(history.snapshots.map((entry) => entry.summary.name)).toEqual(['Nyack Plumbing Co'])
    expect(maps.opened.length).toBe(opened)
  })

  it('an audit notes the parts it could not read and judges the rest', async () => {
    deps = fakeDeps(maps, {
      website: async () => {
        throw new Error('Local SEO has no access to www.nyackplumbing.com yet.')
      },
    })
    const audit = (await call('audit_profile', { business: { cid: '111' } })) as {
      notes: string[]
      score: { judged: number }
      reportMarkdown: string
      findings: { checkId: string; status: string; summary: string }[]
    }
    expect(audit.notes).toEqual([
      expect.stringMatching(/^Maps' Overview shows only the owner's newest post/),
      'The website was not read: Local SEO has no access to www.nyackplumbing.com yet.',
    ])
    const posting = audit.findings.filter((f) => ['L26', 'L27', 'L28', 'L29'].includes(f.checkId))
    expect(posting.map((f) => f.status)).toEqual(Array(4).fill('not_applicable'))
    expect(audit.score.judged).toBeGreaterThan(0)
    expect(audit.reportMarkdown).toContain('## Not read')
  })

  it('a profile read from Maps in German says fields may be missing, in the audit and reviews', async () => {
    const german = new FakeMaps(() => ({ place: business, reviews: [aReview()], language: 'de' }))
    deps = fakeDeps(german, { website: async () => Promise.reject(new Error('offline')) })
    const audit = (await call('audit_profile', { business: { cid: '111' } })) as {
      notes: string[]
    }
    const note = /^Google Maps showed this page in German \(de\).*hl=en/
    expect(audit.notes[0]).toMatch(note)
    const reviews = (await call('read_reviews', { business: { cid: '111' } })) as {
      notes: string[]
    }
    expect(reviews.notes[0]).toMatch(note)
  })

  it("an audit of reviews in Maps' own order does not judge their recency", async () => {
    const reviewed = aBusiness({ ids: business.ids, reviewCount: 2 })
    const unsorted = new FakeMaps(() => ({
      place: reviewed,
      reviews: [aReview({ rating: 5 }), aReview({ rating: 4 })],
      newestFirst: false,
    }))
    deps = fakeDeps(unsorted, { website: async () => Promise.reject(new Error('offline')) })
    const audit = (await call('audit_profile', { business: { cid: '111' } })) as {
      notes: string[]
      findings: { checkId: string; status: string; summary: string }[]
    }
    const recency = audit.findings.filter((f) => ['L22', 'L24', 'L25'].includes(f.checkId))
    expect(recency.map((f) => f.status)).toEqual([
      'not_applicable',
      'not_applicable',
      'not_applicable',
    ])
    expect(recency[0]?.summary).toMatch(/"Most relevant" sample/)
    expect(audit.notes[0]).toMatch(/"Most relevant" sample/)
  })

  it('local AI visibility scores each answer, and an engine not read is missing', async () => {
    deps = fakeDeps(maps, {
      answers: async () => ({
        cloro: null,
        assist: async (engine) =>
          engine === 'chatgpt'
            ? {
                kind: 'answer',
                answer: { text: '1. **Nyack Plumbing Co** - fast.', citedUrls: [] },
              }
            : { kind: 'missing', reason: 'Nobody sent the prompt.' },
      }),
    })
    const result = (await call('local_ai_visibility', {
      query: 'plumber',
      city: 'West Nyack, NY',
      businessName: 'Nyack Plumbing Co',
      engines: ['chatgpt', 'gemini'],
    })) as { prompt: string; answers: { answer: unknown }[] }
    expect(result.prompt).toBe('What is the best plumber in West Nyack, NY?')
    expect(result.answers[0]?.answer).toMatchObject({ verdict: 'recommended', position: 1 })
    expect(result.answers[1]?.answer).toEqual({ missing: true, reason: 'Nobody sent the prompt.' })
  })
})
