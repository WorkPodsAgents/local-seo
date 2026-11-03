// The one path every paid call takes: the cache first, then the spend cap, then the provider.
// A reservation is released when the call fails, since DataForSEO and Cloro charge nothing for a
// refused or failed request.
import type { ResponseCache } from './cache'
import type { Paid, Provider } from './failure'
import type { SpendLedger } from './spend'

export interface PaidDeps {
  readonly ledger: SpendLedger
  readonly cache: ResponseCache
}

/** What the provider answered and what it reported charging. */
export interface Charged {
  readonly response: unknown
  readonly costUsd: number
}

export async function paidCall(
  deps: PaidDeps,
  provider: Provider,
  endpoint: string,
  body: unknown,
  estimateUsd: number,
  send: () => Promise<Charged>,
): Promise<Paid<unknown>> {
  const hit = await deps.cache.get(provider, endpoint, body)
  if (hit !== undefined) return { data: hit, costUsd: 0, cached: true }
  const reservation = await deps.ledger.authorize(provider, estimateUsd)
  let charged: Charged
  try {
    charged = await send()
  } catch (error) {
    reservation.release()
    throw error
  }
  await reservation.settle(charged.costUsd)
  await deps.cache.put(provider, endpoint, body, charged.response)
  return { data: charged.response, costUsd: charged.costUsd, cached: false }
}
