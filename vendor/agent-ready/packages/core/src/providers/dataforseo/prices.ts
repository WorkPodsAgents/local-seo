// DataForSEO list prices in USD, ported from WorkPods' DataForSeoPrices.kt. They are estimates the
// spend cap is checked against before a call; what a call cost is the `cost` its response reports.

/** A Labs task: $0.012 plus $0.00012 per row. */
const LABS_TASK = 0.012
const LABS_ROW = 0.00012

/** A Backlinks task: $0.024 plus $0.000036 per row. */
const BACKLINKS_TASK = 0.024
const BACKLINKS_ROW = 0.000036

/** A live SERP page of 10 results: the queued price of $0.0006 times 3.3, rounded up. */
const SERP_LIVE_PER_TEN = 0.002

/** A Labs task returning up to `rows` rows. */
export function labsPrice(rows: number): number {
  return LABS_TASK + LABS_ROW * rows
}

/** A Backlinks task returning up to `rows` rows. */
export function backlinksPrice(rows: number): number {
  return BACKLINKS_TASK + BACKLINKS_ROW * rows
}

/** A live organic SERP read to `depth` results. */
export function serpLivePrice(depth: number): number {
  return SERP_LIVE_PER_TEN * Math.ceil(depth / 10)
}
