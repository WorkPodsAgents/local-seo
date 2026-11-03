// What can go wrong with a paid provider call, as values the panel and the bridge can explain.
// A failure never carries provider text, so a credential echoed in an error body cannot leak.

export type Provider = 'dataforseo' | 'cloro'

export type ProviderFailure =
  /** No credentials in the vault for this provider. */
  | { readonly code: 'not_configured'; readonly provider: Provider }
  | { readonly code: 'auth_failed'; readonly provider: Provider }
  /** The account lacks this API, such as DataForSEO Backlinks without its subscription. */
  | { readonly code: 'no_access'; readonly provider: Provider }
  /** The account balance cannot pay for the call. */
  | { readonly code: 'no_funds'; readonly provider: Provider }
  | { readonly code: 'rate_limited'; readonly provider: Provider; readonly retryAfterS: number }
  /** The user has not set a monthly cap, so no paid call may run. */
  | { readonly code: 'cap_not_set'; readonly provider: Provider }
  | {
      readonly code: 'over_cap'
      readonly provider: Provider
      readonly capUsd: number
      readonly spentUsd: number
      readonly estimateUsd: number
    }
  /** The request was refused as invalid; `status` is the provider's code. */
  | { readonly code: 'refused'; readonly provider: Provider; readonly status: number }
  | { readonly code: 'invalid_input'; readonly provider: Provider; readonly field: string }
  /** Unreachable, a 5xx or another status that a retry later may fix; null when no answer came. */
  | { readonly code: 'unavailable'; readonly provider: Provider; readonly status: number | null }
  | { readonly code: 'invalid_response'; readonly provider: Provider }

export class ProviderError extends Error {
  readonly failure: ProviderFailure
  constructor(failure: ProviderFailure) {
    super(`${failure.provider}: ${failure.code}`)
    this.name = 'ProviderError'
    this.failure = failure
  }
}

/** A paid result: what it cost (0 when served from the cache) and whether it was cached. */
export interface Paid<T> {
  readonly data: T
  readonly costUsd: number
  readonly cached: boolean
}
