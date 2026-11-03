import { describe, expect, it } from 'vitest'
import { missing, type Business } from '@local-seo/core/business'
import { gridPoints } from '@local-seo/core/geo'
import { aBusiness, aPost, aReview } from '../../../packages/core/test/business'
import { pointRank, runGrid, STOPPED_BY_USER, type PointRead } from '../../src/maps/grid'
import { blockedReason, GoogleBlocked, type MapsPage } from '../../src/maps/page'
import { openBusiness, resolveNear } from '../../src/maps/resolve'
import { createLocalTools } from '../../src/services/tools'
import { FakeMaps, fakeDeps, ranked } from './fakes'

const target = aBusiness({ ids: { placeId: null, cid: '111', kgId: null, featureId: null } })

describe('opening a business the tools were given', () => {
  it('given a CID, then the place page opens by it and is read', async () => {
    const maps = new FakeMaps(() => ({ place: target }))
    expect((await openBusiness(maps, { cid: '111' })).name).toBe('Nyack Plumbing Co')
    expect(maps.opened).toEqual(['https://www.google.com/maps?cid=111'])
  })

  it('given a name and town, then the matching result is opened by its CID', async () => {
    const maps = new FakeMaps((url) =>
      url.includes('/search/')
        ? { results: [ranked(1, 'Rockland Rooter', '9'), ranked(2, 'Nyack Plumbing Co', '111')] }
        : { place: target },
    )
    await openBusiness(maps, { name: 'Nyack Plumbing Co', city: 'West Nyack, NY' })
    expect(maps.opened.at(-1)).toBe('https://www.google.com/maps?cid=111')
  })

  it('when no result has the name, then it says so instead of opening another place', async () => {
    const maps = new FakeMaps(() => ({ results: [ranked(1, 'Rockland Rooter', '9')] }))
    await expect(openBusiness(maps, { name: 'Valley Pipes', city: 'Nyack' })).rejects.toThrow(
      'no place named "Valley Pipes"',
    )
  })

  it('when Google shows its unusual traffic page, then reading stops with its reason', async () => {
    const sorry = 'https://www.google.com/sorry/index?continue=x'
    const maps = new FakeMaps(() => ({ blocked: blockedReason(sorry) ?? '' }))
    await expect(openBusiness(maps, { cid: '111' })).rejects.toBeInstanceOf(GoogleBlocked)
    expect(blockedReason(sorry)).toContain('unusual traffic')
    expect(blockedReason('https://consent.google.com/m?x')).toContain('consent')
    expect(blockedReason('https://www.google.com/maps/place/x')).toBeNull()
  })

  it('a place name is looked up and the map centre Maps settles on is the point', async () => {
    const maps = new FakeMaps(() => ({
      landsOn: 'https://www.google.com/maps/place/Leeds/@53.8007554,-1.5490774,12z',
    }))
    expect(await resolveNear(maps, 'Leeds, UK')).toEqual({ lat: 53.8007554, lng: -1.5490774 })
    expect(await resolveNear(maps, { lat: 1, lng: 2 })).toEqual({ lat: 1, lng: 2 })
  })
})

describe('a Maps page that is still settling', () => {
  const other = aBusiness({
    name: 'Rockland Rooter',
    ids: { placeId: null, cid: '9', kgId: null, featureId: null },
  })
  /** A tab whose place reads answer from `answers` in turn, the last one repeating. */
  const settling = (answers: readonly (Business | null)[]) => {
    const opened: string[] = []
    let reads = 0
    const page: MapsPage = {
      open: async (url) => (opened.push(url), { url, blocked: null }),
      currentUrl: async () => 'https://www.google.com/maps/place/Nyack+Plumbing+Co/data=!4m2',
      read: (async (type: string) =>
        type === 'maps:readPlace'
          ? (answers[Math.min(reads++, answers.length - 1)] ?? null)
          : null) as MapsPage['read'],
      wait: async () => undefined,
    }
    return { page, opened }
  }

  it('given the last place still showing, then it waits for the place asked for', async () => {
    const { page } = settling([null, other, other, target])
    expect((await openBusiness(page, { cid: '111' })).ids.cid).toBe('111')
  })

  it('given the place never shows, then it says so after waiting', async () => {
    const { page } = settling([other])
    await expect(openBusiness(page, { cid: '111' })).rejects.toThrow('showed no place')
  })

  it("given a CID open without Maps' place data, then its own address loads once", async () => {
    const reload = 'Reload the Maps page so Local SEO can read the full profile'
    const bare = aBusiness({ categories: { primary: 'Plumber', secondary: missing(reload) } })
    const { page, opened } = settling([bare, target])
    const place = await openBusiness(page, { cid: '111' })
    expect(place.categories.secondary).toEqual(target.categories.secondary)
    expect(opened).toEqual([
      'https://www.google.com/maps?cid=111',
      'https://www.google.com/maps/place/Nyack+Plumbing+Co/data=!4m2',
    ])
  })
})

describe('a browser geo grid', () => {
  const points = gridPoints({ lat: 41.0973, lng: -73.9934 }, 3, 1)
  const at = (rank: number): PointRead => ({
    kind: 'results',
    results: [ranked(1, 'Other', '9'), ranked(2, 'Nyack Plumbing Co', '111')].slice(0, rank),
    stoppedBy: 'end',
  })

  it('reads every point with a pause between searches, never after the last', async () => {
    const pauses: number[] = []
    const cells = await runGrid({
      points,
      target,
      depth: 20,
      read: async () => at(2),
      pauseMs: 4000,
      sleep: async (ms) => void pauses.push(ms),
    })
    expect(cells.map((cell) => cell.rank)).toEqual(points.map(() => ({ kind: 'ranked', rank: 2 })))
    expect(pauses).toEqual(Array(8).fill(4000))
  })

  it('stops at the first blocked page and marks every point left unknown with why', async () => {
    let reads = 0
    const cells = await runGrid({
      points,
      target,
      depth: 20,
      read: async () => {
        reads += 1
        return reads === 3 ? { kind: 'blocked', reason: 'unusual traffic' } : at(1)
      },
      pauseMs: 0,
      sleep: async () => undefined,
    })
    expect(reads).toBe(3)
    expect(cells.map((cell) => cell.rank.kind)).toEqual([
      'not_found',
      'not_found',
      ...Array(7).fill('unknown'),
    ])
    expect(cells.at(-1)?.rank).toEqual({ kind: 'unknown', reason: 'unusual traffic' })
  })

  it('says not found only as deep as Maps listed, and unknown when no list was read', () => {
    const eight = Array.from({ length: 8 }, (_, n) => ranked(n + 1, `Rival ${n}`, `${n + 50}`))
    expect(pointRank(eight, 'end', target, 20)).toEqual({ kind: 'not_found', depth: 8 })
    expect(pointRank([], 'no_list', target, 20)).toMatchObject({ kind: 'unknown' })
    expect(pointRank([], 'end', target, 20)).toMatchObject({ kind: 'unknown' })
    expect(pointRank(eight, 'step_cap', target, 20)).toMatchObject({ kind: 'unknown' })
    // A provider's answer is the whole list, so even a short one says not found.
    expect(pointRank(eight, null, target, 20)).toEqual({ kind: 'not_found', depth: 8 })
  })

  it('a point that fails to load is unknown and the grid goes on; Stop ends it', async () => {
    let reads = 0
    const cells = await runGrid({
      points,
      target,
      depth: 20,
      read: async () => {
        reads += 1
        if (reads === 1) throw new Error('The page did not answer within 45 s.')
        return at(2)
      },
      pauseMs: 0,
      sleep: async () => undefined,
      stopped: () => reads >= 4,
    })
    expect(cells[0]?.rank).toEqual({
      kind: 'unknown',
      reason: 'The page did not answer within 45 s.',
    })
    expect(cells[1]?.rank).toEqual({ kind: 'ranked', rank: 2 })
    expect(cells[4]?.rank).toEqual({ kind: 'unknown', reason: STOPPED_BY_USER })
  })
})

describe('reading posts in the browser', () => {
  const tools = (stoppedBy: 'limited_view' | 'end', posts = [] as ReturnType<typeof aPost>[]) =>
    createLocalTools(fakeDeps(new FakeMaps(() => ({ place: target, posts, stoppedBy }))))

  it("given Google's signed-out view hid every post, then posts are unknown", async () => {
    const read = await tools('limited_view').read_posts({ business: { cid: '111' } })
    expect(read.posts).toEqual([])
    expect(read.unknown).toMatch(/signed-out view of Maps hides/)
  })

  it('given signed in, then only the newest post is read and cadence is unknown', async () => {
    const read = await tools('end', [aPost()]).read_posts({ business: { cid: '111' } })
    expect(read.posts).toHaveLength(1)
    expect(read.truncated).toBe(true)
    expect(read.unknown).toMatch(/^Maps' Overview shows only the owner's newest post/)
  })
})

describe('reading reviews through DataForSEO', () => {
  const paidReviews = (place: ReturnType<typeof aBusiness>) => {
    const targets: unknown[] = []
    const deps = fakeDeps(new FakeMaps(() => ({ place })), {
      dataForSeo: {
        ...fakeDeps(new FakeMaps(() => ({}))).dataForSeo,
        reviews: async (target) => {
          targets.push(target.location)
          return { data: [], costUsd: 0.0075, cached: false }
        },
      },
    })
    const read = createLocalTools(deps).read_reviews({
      business: { cid: '111' },
      source: 'dataforseo',
    })
    return { read, targets }
  }

  it("given the place's pin, then DataForSEO looks for it there", async () => {
    const { read, targets } = paidReviews(target)
    await read
    expect(targets).toEqual([{ lat: 41.0973, lng: -73.9934 }])
  })

  it('given no pin but a country, then DataForSEO looks in that country', async () => {
    const { read, targets } = paidReviews(
      aBusiness({ location: missing('not read'), address: { ...ukAddress } }),
    )
    await read
    expect(targets).toEqual([2826])
  })

  it('given neither pin nor country, then nothing is paid and a country is asked for', async () => {
    const noCountry = { ...ukAddress, country: null }
    const { read, targets } = paidReviews(
      aBusiness({ location: missing('not read'), address: noCountry }),
    )
    await expect(read).rejects.toThrow('Say which country the business is in')
    expect(targets).toEqual([])
  })
})

const ukAddress = {
  formatted: '1 King St, Manchester M2 4WU, UK',
  street: '1 King St',
  city: 'Manchester',
  region: null,
  postalCode: 'M2 4WU',
  country: 'GB',
}

describe('the history of a business given by name', () => {
  it('given two saved places with one name, then Maps picks which one by its id', async () => {
    const maps = new FakeMaps(() => ({
      results: [ranked(1, 'Rockland Rooter', '9'), ranked(2, 'Nyack Plumbing Co', '111')],
    }))
    const deps = fakeDeps(maps)
    const elsewhere = aBusiness({
      ids: { placeId: null, cid: '222', kgId: null, featureId: null },
      phone: '+1 914-555-0199',
    })
    // Read last, the other place holds the name's alias, which a lookup by name alone follows.
    await deps.snapshots.save(target)
    await deps.snapshots.save(elsewhere)
    const history = await createLocalTools(deps).profile_history({
      business: { name: 'Nyack Plumbing Co', city: 'West Nyack, NY' },
    })
    expect(maps.opened).toEqual([
      'https://www.google.com/maps/search/Nyack+Plumbing+Co+West+Nyack%2C+NY',
    ])
    expect(history.snapshots.map((entry) => entry.summary.cid)).toEqual(['111'])
  })
})

describe('the history of a business given by short link', () => {
  it('given a link with no id, then Maps resolves it once and the link is remembered', async () => {
    const link = 'https://maps.app.goo.gl/AbCdEf123'
    const maps = new FakeMaps(() => ({ place: target }))
    const deps = fakeDeps(maps)
    await deps.snapshots.save(target)
    const tools = createLocalTools(deps)
    const first = await tools.profile_history({ business: { mapsUrl: link } })
    expect(first.snapshots.map((entry) => entry.summary.cid)).toEqual(['111'])
    expect(maps.opened).toEqual([link])
    await tools.profile_history({ business: { mapsUrl: link } })
    expect(maps.opened).toEqual([link])
  })
})

describe('category ideas from the competitors', () => {
  it('given twelve competitors, then only the top eight profiles are opened', async () => {
    const others = Array.from({ length: 12 }, (_, at) =>
      ranked(at + 1, `Rival ${at}`, `${at + 500}`),
    )
    const maps = new FakeMaps((url) =>
      url.includes('/search/') ? { results: others } : { place: target },
    )
    const ideas = await createLocalTools(fakeDeps(maps)).category_ideas({ query: 'plumber' })
    expect(maps.opened.filter((url) => url.includes('?cid='))).toHaveLength(8)
    expect(ideas.competitorsRead).toBe(12)
  })
})

describe('reading reviews in the browser', () => {
  const read = (
    site: { reviewsTab: boolean; stoppedBy: 'end' | 'limited_view' | 'want' },
    place: Business = target,
    newestFirst = true,
  ) =>
    createLocalTools(
      fakeDeps(
        new FakeMaps(() => ({ place, reviews: [aReview(), aReview()], newestFirst, ...site })),
      ),
    ).read_reviews({ business: { cid: '111' }, max: 2 })

  it('given no Reviews tab opens, then the Overview reviews come with a note', async () => {
    const result = await read({ reviewsTab: false, stoppedBy: 'end' })
    expect(result.read).toBe(2)
    expect(result.order).toBe('most_relevant')
    expect(result.notes[0]).toBe(
      "Maps' Reviews tab did not open, so these are only the few reviews its Overview shows.",
    )
  })

  it('given the Newest sort applies, then the reviews are newest first with no note', async () => {
    const result = await read({ reviewsTab: true, stoppedBy: 'end' })
    expect(result).toMatchObject({ order: 'newest', notes: [] })
  })

  it('given Maps keeps its own order, then the reviews are said to be a sample', async () => {
    const result = await read({ reviewsTab: true, stoppedBy: 'end' }, target, false)
    expect(result.order).toBe('most_relevant')
    expect(result.notes).toEqual([expect.stringMatching(/"Most relevant" sample, not the newest/)])
  })

  it('given no known review count, then a read stopped at max is truncated', async () => {
    const unknownCount = { ...target, reviewCount: missing('not shown') }
    const result = await read({ reviewsTab: true, stoppedBy: 'want' }, unknownCount)
    expect(result.truncated).toBe(true)
  })

  it("given Google's signed-out view, then the short read says why", async () => {
    const result = await read({ reviewsTab: true, stoppedBy: 'limited_view' })
    expect(result.truncated).toBe(true)
    expect(result.notes[0]).toMatch(/^Signed out of Google, Maps shows only about five reviews/)
  })
})
