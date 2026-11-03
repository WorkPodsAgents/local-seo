// Maps loads results, reviews and posts only as the user scrolls their list. The readers scroll it
// for them, but a list that never ends (or a page that stops answering) must not hold the tab, so
// every scroll is bounded by a wanted count, a patience for no growth and a hard step cap.

/** A scrollable list and how many items it holds now; the part-B readers supply both. */
export interface Feed {
  readonly container: Element
  readonly count: () => number
}

export interface ScrollLimits {
  /** Stop once the list holds this many items. */
  readonly want: number
  /** Stop after this many scrolls in a row that load nothing new. */
  readonly patience: number
  /** Never scroll more than this many times, whatever the list does. */
  readonly maxSteps: number
  /** Time for the page to load the next batch after each scroll, in milliseconds. */
  readonly settleMs: number
}

/**
 * Why the scroll stopped, returned with the items so a tool can say whether a list is complete:
 * `want` reached the count, `end` saw no growth (the list is exhausted or stalled), `step_cap`
 * hit the hard cap with the list still growing.
 */
export type ScrollStop = 'want' | 'end' | 'step_cap'

export type Sleep = (ms: number) => Promise<void>

export const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function scrollFeed(
  feed: Feed,
  limits: ScrollLimits,
  sleep: Sleep,
): Promise<ScrollStop> {
  let seen = feed.count()
  let still = 0
  for (let step = 0; step < limits.maxSteps; step += 1) {
    if (seen >= limits.want) return 'want'
    feed.container.scrollTop = feed.container.scrollHeight
    await sleep(limits.settleMs)
    const now = feed.count()
    still = now > seen ? 0 : still + 1
    seen = now
    if (still >= limits.patience) return 'end'
  }
  return seen >= limits.want ? 'want' : 'step_cap'
}

/**
 * Why a list read ended: how the scroll stopped, `no_list` when the page shows no list, or
 * `limited_view` when the list ran out while Maps showed its signed-out limited view, which
 * holds items back.
 */
export type ListStop = ScrollStop | 'no_list' | 'limited_view'

export interface ScrolledList<T> {
  readonly items: readonly T[]
  readonly stoppedBy: ListStop
}

/** A caller's `max` as a whole count from 1 to `cap`, so one message cannot scroll forever. */
export function boundedWant(max: number, cap: number): number {
  if (!Number.isFinite(max)) return cap
  return Math.min(cap, Math.max(1, Math.floor(max)))
}

/** Scrolls the list (when the page shows one) until `want` items load, then reads them. */
export async function scrollAndRead<T>(
  feed: Feed | null,
  limits: ScrollLimits,
  sleep: Sleep,
  read: (root: ParentNode) => readonly T[],
): Promise<ScrolledList<T>> {
  if (feed === null) return { items: [], stoppedBy: 'no_list' }
  const stoppedBy = await scrollFeed(feed, limits, sleep)
  return { items: read(feed.container).slice(0, limits.want), stoppedBy }
}
