// DataForSEO list prices in USD, checked on 2026-11-02 against
//   https://dataforseo.com/pricing/business-data/business-data-api (Updates),
//   https://dataforseo.com/pricing/business-data/google-reviews-api (Reviews),
//   https://dataforseo.com/pricing/google-serp/google-maps-serp-api (Maps SERP).
// The 2026-07-01 rise (https://dataforseo.com/update/pricing-update-in-dataforseo-apis) raised
// Business Listings Search and Categories Aggregation by 20%; none of the endpoints below. They
// are estimates for the spend cap; what a call cost is the `cost` its response reports.

/** Standard tasks wait in a queue (up to 45 minutes); priority tasks cost double and run fast. */
export type Priority = 'standard' | 'high'

const REVIEWS_PER_TEN: Readonly<Record<Priority, number>> = { standard: 0.00075, high: 0.0015 }
const UPDATES_TASK: Readonly<Record<Priority, number>> = { standard: 0.0015, high: 0.003 }
const UPDATES_PER_TEN: Readonly<Record<Priority, number>> = { standard: 0.00075, high: 0.0015 }

/** A Maps SERP live page of up to 100 results: $2.00 per 1,000; each further 100 adds the base. */
const MAPS_LIVE_PER_HUNDRED = 0.002

/** Reviews are billed per block of 10 (a depth of 11 is two blocks), with no task fee. */
export function reviewsPrice(depth: number, priority: Priority): number {
  return REVIEWS_PER_TEN[priority] * Math.ceil(depth / 10)
}

export function updatesPrice(depth: number, priority: Priority): number {
  return UPDATES_TASK[priority] + UPDATES_PER_TEN[priority] * Math.ceil(depth / 10)
}

export function mapsLivePrice(depth: number): number {
  return MAPS_LIVE_PER_HUNDRED * Math.ceil(depth / 100)
}
