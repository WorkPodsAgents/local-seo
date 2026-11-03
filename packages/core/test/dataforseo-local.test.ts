// DataForSEO clients against the documentation's example responses, with fetch stubbed: no test
// reaches DataForSEO.
import {
  createResponseCache,
  createSpendLedger,
  ProviderError,
} from '@open-agent-ready/core/providers'
import type { KeyValueStore } from '@open-agent-ready/core/providers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalDataForSeo,
  reviewsPrice,
  TASK_LIFE_MS,
  updatesPrice,
} from '../src/providers/dataforseo-local'
import type { LocalDataForSeoDeps } from '../src/providers/dataforseo-local'
import mapsLive from './fixtures/dataforseo/maps_live.json' with { type: 'json' }
import reviewsGet from './fixtures/dataforseo/reviews_task_get.json' with { type: 'json' }
import reviewsPost from './fixtures/dataforseo/reviews_task_post.json' with { type: 'json' }
import updatesGet from './fixtures/dataforseo/updates_task_get.json' with { type: 'json' }
import updatesPost from './fixtures/dataforseo/updates_task_post.json' with { type: 'json' }

const NOW = Date.parse('2026-11-02T12:00:00Z')
const REVIEWS_ID = reviewsPost.tasks[0]!.id
const UPDATES_ID = updatesPost.tasks[0]!.id
/** What task_get answers while the task waits (status as documented in the errors appendix). */
const IN_QUEUE = {
  status_code: 20000,
  cost: 0,
  tasks: [{ status_code: 40602, status_message: 'Task In Queue.', result: null }],
}

function memoryStore(): KeyValueStore {
  const data = new Map<string, unknown>()
  return {
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, JSON.parse(JSON.stringify(value))),
    remove: async (key) => void data.delete(key),
  }
}

interface Sent {
  readonly method: string
  readonly path: string
  readonly body: unknown
}

/** Each path answers with its responses in turn; the last one repeats. */
function stubFetch(routes: Record<string, unknown[]>): Sent[] {
  const sent: Sent[] = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    const path = new URL(input).pathname
    sent.push({
      method: init.method ?? 'GET',
      path,
      body: init.body ? JSON.parse(String(init.body)) : null,
    })
    const answers = routes[path]
    if (answers === undefined) throw new Error(`unexpected request to ${path}`)
    const answer = answers.length > 1 ? answers.shift() : answers[0]
    return new Response(JSON.stringify(answer), { status: 200 })
  })
  return sent
}

async function client(changes: Partial<LocalDataForSeoDeps> = {}) {
  const storage = memoryStore()
  const clock = () => NOW
  const ledger = createSpendLedger({ storage, clock })
  await ledger.setCap('dataforseo', 1)
  const sleep = vi.fn(async () => undefined)
  const deps: LocalDataForSeoDeps = {
    ledger,
    cache: createResponseCache({ storage, clock }),
    taskIds: createResponseCache({ storage, clock, ttlMs: TASK_LIFE_MS }),
    credentials: async () => ({ login: 'me@example.com', password: 'secret' }),
    sleep,
    clock,
    ...changes,
  }
  return { api: createLocalDataForSeo(deps), ledger, sleep }
}

const TARGET = { id: { cid: '2946633002421908862' }, location: 'New York,New York,United States' }

afterEach(() => vi.unstubAllGlobals())

describe('DataForSEO local clients', () => {
  it('when reviews are asked for at a pin, then a task is posted there and mapped', async () => {
    const sent = stubFetch({
      '/v3/business_data/google/reviews/task_post': [reviewsPost],
      [`/v3/business_data/google/reviews/task_get/${REVIEWS_ID}`]: [IN_QUEUE, reviewsGet],
    })
    const { api, ledger, sleep } = await client()
    const pin = { lat: 41.0960821234, lng: -73.9561337 }
    const paid = await api.reviews({ ...TARGET, location: pin }, { depth: 50 })
    expect(sent[0]?.body).toEqual([
      {
        cid: '2946633002421908862',
        location_coordinate: '41.0960821,-73.9561337,200',
        language_code: 'en',
        depth: 50,
        sort_by: 'newest',
        priority: 2,
      },
    ])
    expect(sent.slice(1).map((request) => request.method)).toEqual(['GET', 'GET'])
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(paid.data).toHaveLength(3)
    expect(paid.data[1]).toMatchObject({
      id: 'ChZDSUhNMG9nS0VJQ0FnSUMxbHFyMFlnEAE',
      rating: 5,
      publishedAt: '2024-01-05T14:09:32.000Z',
      ownerReply: { publishedAt: '2024-02-05T14:09:32.000Z' },
      photoCount: 10,
    })
    expect(paid.data[0]?.ownerReply).toBeNull()
    // The cost task_post reported, not the estimate.
    expect((await ledger.summary()).providers.dataforseo.spentUsd).toBe(reviewsPost.cost)
  })

  it('when posts are asked for, then updates map with their link, media and date', async () => {
    stubFetch({
      '/v3/business_data/google/my_business_updates/task_post': [updatesPost],
      [`/v3/business_data/google/my_business_updates/task_get/${UPDATES_ID}`]: [updatesGet],
    })
    const { api } = await client()
    const posts = (await api.posts(TARGET)).data
    expect(posts[0]).toMatchObject({
      link: null,
      hasMedia: true,
      publishedAt: '2020-04-02T00:00:00.000Z',
      kind: 'unknown',
    })
    expect(posts[2]?.link).toBe('https://www.rustybrick.com/double-header.html')
  })

  it('when polling fails after a paid post, then it stays spent and a retry polls that task', async () => {
    const sent = stubFetch({
      '/v3/business_data/google/reviews/task_post': [reviewsPost],
      [`/v3/business_data/google/reviews/task_get/${REVIEWS_ID}`]: [
        IN_QUEUE,
        IN_QUEUE,
        IN_QUEUE,
        reviewsGet,
      ],
    })
    const { api, ledger, sleep } = await client({ maxPolls: 3 })
    const failure = await api.reviews(TARGET).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ProviderError)
    expect((failure as ProviderError).failure).toEqual({
      code: 'unavailable',
      provider: 'dataforseo',
      status: null,
    })
    expect(sleep).toHaveBeenCalledTimes(3)
    expect((await ledger.summary()).providers.dataforseo.spentUsd).toBe(reviewsPost.cost)

    const retry = await api.reviews(TARGET)
    expect(retry.data).toHaveLength(3)
    const posts = sent.filter((request) => request.path.endsWith('/task_post'))
    expect(posts).toHaveLength(1)
    expect((await ledger.summary()).providers.dataforseo.spentUsd).toBe(reviewsPost.cost)
  })

  it('when a posted task reports no cost, then the estimate is charged, not zero', async () => {
    const { cost: _cost, ...withoutCost } = updatesPost
    stubFetch({
      '/v3/business_data/google/my_business_updates/task_post': [withoutCost],
      [`/v3/business_data/google/my_business_updates/task_get/${UPDATES_ID}`]: [updatesGet],
    })
    const { api, ledger } = await client()
    const paid = await api.posts(TARGET, { depth: 20 })
    expect(paid.costUsd).toBeCloseTo(updatesPrice(20, 'high'))
    expect((await ledger.summary()).providers.dataforseo.spentUsd).toBeCloseTo(
      updatesPrice(20, 'high'),
    )
  })

  it('when a Maps search runs from a point, then the coordinate carries the zoom', async () => {
    const sent = stubFetch({ '/v3/serp/google/maps/live/advanced': [mapsLive] })
    const { api } = await client()
    const at = { lat: 52.6178549, lng: -155.352142 }
    const paid = await api.mapsAt('albert einstein', at, 20, { depth: 3 })
    expect(sent[0]?.body).toEqual([
      {
        keyword: 'albert einstein',
        location_coordinate: '52.6178549,-155.352142,20z',
        language_code: 'en',
        depth: 3,
      },
    ])
    expect(paid.data).toMatchObject({ surface: 'maps', query: 'albert einstein', from: at })
    expect(paid.data.results.map((r) => [r.position, r.name, r.rating, r.reviewCount])).toEqual([
      [1, 'Albert Einstein Statue', null, null],
      [2, 'Albert Einstein Memorial', 4.7, 1283],
      [3, 'The Albert Einstein Group, Inc.', 4, 4],
    ])
    expect(paid.data.results[0]?.location).toEqual({ lat: 35.5064351, lng: -97.6317255 })
  })

  it('given no credentials, then no request is sent and the call says not configured', async () => {
    const sent = stubFetch({})
    const { api } = await client({ credentials: async () => null })
    await expect(api.reviews(TARGET)).rejects.toMatchObject({
      failure: { code: 'not_configured', provider: 'dataforseo' },
    })
    expect(sent).toEqual([])
  })

  it('then estimates bill reviews per started block of ten', () => {
    expect(reviewsPrice(11, 'standard')).toBeCloseTo(0.0015)
    expect(updatesPrice(10, 'high')).toBeCloseTo(0.0045)
  })
})
