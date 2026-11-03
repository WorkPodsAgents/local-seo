import { describe, expect, it } from 'vitest'
import {
  boundedWant,
  scrollAndRead,
  scrollFeed,
  type Feed,
  type ScrollLimits,
} from '../../src/readers/paging'

/** A list that loads `batch` more items on each scroll to its end, up to `total`. */
function fakeFeed(batch: number, total: number): Feed & { scrolls: () => number } {
  let loaded = Math.min(batch, total)
  let scrolls = 0
  const container = {
    scrollHeight: 1000,
    get scrollTop() {
      return 0
    },
    set scrollTop(_to: number) {
      scrolls += 1
      loaded = Math.min(loaded + batch, total)
    },
  }
  return { container: container as unknown as Element, count: () => loaded, scrolls: () => scrolls }
}

const LIMITS: ScrollLimits = { want: 25, patience: 3, maxSteps: 40, settleMs: 800 }
const noWait = async () => {}

describe('scrolling a list Maps loads as it scrolls', () => {
  it('stops as soon as the wanted number of items has loaded', async () => {
    const feed = fakeFeed(10, 100)
    expect(await scrollFeed(feed, LIMITS, noWait)).toBe('want')
    expect(feed.scrolls()).toBe(2)
  })

  it('stops after the patience runs out when the list stops growing', async () => {
    const feed = fakeFeed(10, 15)
    expect(await scrollFeed(feed, LIMITS, noWait)).toBe('end')
    expect(feed.scrolls()).toBe(1 + LIMITS.patience)
  })

  it('never scrolls past the step cap, even while the list still grows', async () => {
    const feed = fakeFeed(1, 1000)
    const limits = { ...LIMITS, want: 500, maxSteps: 5 }
    expect(await scrollFeed(feed, limits, noWait)).toBe('step_cap')
    expect(feed.scrolls()).toBe(5)
  })

  it('waits the settle time after every scroll', async () => {
    const waits: number[] = []
    await scrollFeed(fakeFeed(10, 100), LIMITS, async (ms) => void waits.push(ms))
    expect(waits).toEqual([800, 800])
  })

  it('returns no items and says so when the page shows no list', async () => {
    expect(await scrollAndRead(null, LIMITS, noWait, () => [1])).toEqual({
      items: [],
      stoppedBy: 'no_list',
    })
  })

  it('reads no more items than were wanted', async () => {
    const feed = fakeFeed(10, 100)
    const read = await scrollAndRead(feed, LIMITS, noWait, () =>
      Array.from({ length: feed.count() }, (_, i) => i),
    )
    expect(read).toEqual({ items: Array.from({ length: 25 }, (_, i) => i), stoppedBy: 'want' })
  })

  it('bounds a caller-given max to a whole count between 1 and the cap', () => {
    expect(boundedWant(30.7, 100)).toBe(30)
    expect(boundedWant(0, 100)).toBe(1)
    expect(boundedWant(1e9, 100)).toBe(100)
    expect(boundedWant(Number.NaN, 100)).toBe(100)
  })
})
