// The one file that wires the paid-provider lane: the spend ledger, the response cache and the
// DataForSEO credentials, read from the vault at call time. Every paid action passes the cache
// first, then the monthly cap, inside core.
import {
  createResponseCache,
  createSpendLedger,
  ProviderError,
  type ProviderFailure,
  type ResponseCache,
} from '@open-agent-ready/core/providers'
import { VaultError } from '@open-agent-ready/core/secrets'
import { ALL_AI_ENGINES, LIMITS } from '@local-seo/core/bridge'
import {
  reviewsPrice,
  TASK_LIFE_MS,
  updatesPrice,
} from '@local-seo/core/providers/dataforseo-local'
import { labsPrice } from '@open-agent-ready/core/providers'
import { cloroEstimateUsd } from '../answers/visibility'
import { clamp } from '../services/reads'
import { gridEstimateUsd } from '../services/tools'
import type { Cost, PaidArgs, PaidOp, PaidRequest } from '../shared/api'
import { formatUsd, PROVIDER_LABEL } from '../shared/cost'
import { handle } from './handle'
import { readSettings } from './settings'
import { cacheStore, localStore } from './stores'
import { vault } from './vault'

const clock = () => Date.now()
const DAY_MS = 86_400_000

export const ledger = createSpendLedger({ storage: localStore, clock })

// The cache window is a setting, so the cache reads it on every lookup.
export const responseCache: ResponseCache = {
  async get(provider, endpoint, body) {
    const ttlMs = (await readSettings()).cacheDays * DAY_MS
    return createResponseCache({ storage: cacheStore, clock, ttlMs }).get(provider, endpoint, body)
  },
  put: (provider, endpoint, body, response) =>
    createResponseCache({ storage: cacheStore, clock }).put(provider, endpoint, body, response),
}

/** Paid DataForSEO task ids: small, and kept for the task's life whatever the cache window. */
export const taskIds = createResponseCache({ storage: localStore, clock, ttlMs: TASK_LIFE_MS })

/** The user's DataForSEO login, or null until both halves are saved in the vault. */
export async function dataForSeoCredentials(): Promise<{ login: string; password: string } | null> {
  const [login, password] = await Promise.all([
    vault.get('dataforseo_login'),
    vault.get('dataforseo_password'),
  ])
  return login === null || password === null ? null : { login, password }
}

/** Each paid action's most it can cost; the type makes a new action without a price fail. */
const PRICES: { readonly [K in PaidOp]: (args: PaidArgs[K]) => Cost } = {
  'paid:geo_grid': ({ size }) => ({ provider: 'dataforseo', usd: gridEstimateUsd(size) }),
  'paid:read_reviews': ({ max }) => ({
    provider: 'dataforseo',
    usd: reviewsPrice(clamp(max ?? LIMITS.reviews.default, LIMITS.reviews.max), 'high'),
  }),
  'paid:read_posts': ({ max }) => ({
    provider: 'dataforseo',
    usd: updatesPrice(clamp(max ?? LIMITS.posts.default, LIMITS.posts.max), 'high'),
  }),
  'paid:category_volumes': ({ categories }) => ({
    provider: 'dataforseo',
    usd: labsPrice(categories.length),
  }),
  'paid:ai_answers': ({ engines }) => ({
    provider: 'cloro',
    usd: cloroEstimateUsd(engines ?? ALL_AI_ENGINES),
  }),
}

/** The most an action can cost, from the provider's list prices; a cached answer costs less. */
export function estimate<K extends PaidOp>(request: { op: K; args: PaidArgs[K] }): Cost {
  return PRICES[request.op](request.args)
}

/** The panel asks for an estimate before every paid action; lanes register their actions here. */
export function registerPaidHandlers(): void {
  handle('estimate', async (request: PaidRequest) => estimate(request))
}

/** A provider failure in plain words; the failure never carries provider text or a secret. */
export function failureText(failure: ProviderFailure): string {
  const name = PROVIDER_LABEL[failure.provider]
  switch (failure.code) {
    case 'not_configured':
      return `Add your ${name} credentials in Settings first.`
    case 'auth_failed':
      return `${name} did not accept your credentials. Check them in Settings.`
    case 'no_access':
      return `Your ${name} account has no access to this data.`
    case 'no_funds':
      return `Your ${name} balance cannot pay for this. Top it up with ${name}.`
    case 'rate_limited':
      return `${name} asked to slow down. Try again in ${failure.retryAfterS} seconds.`
    case 'cap_not_set':
      return `Set a monthly ${name} cap in Settings before the first paid call.`
    case 'over_cap':
      return (
        `This costs about ${formatUsd(failure.estimateUsd)}, and ` +
        `${formatUsd(Math.max(0, failure.capUsd - failure.spentUsd))} is left of this month's ` +
        `${name} cap. Raise the cap in Settings to run it.`
      )
    case 'refused':
      return `${name} refused the request (code ${failure.status}).`
    case 'invalid_input':
      return `${name} cannot use that ${failure.field}.`
    case 'unavailable':
      return `${name} is not answering right now. Try again later.`
    case 'invalid_response':
      return `${name} sent an answer this version cannot read.`
  }
}

/** Runs a paid call, turning a provider failure into a message the user can act on. */
export async function paid<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (error instanceof ProviderError) throw new Error(failureText(error.failure))
    if (error instanceof VaultError && error.code === 'locked') {
      throw new Error('Unlock the vault in Settings to use your provider keys.')
    }
    throw error
  }
}
