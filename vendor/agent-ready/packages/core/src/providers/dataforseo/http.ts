// HTTP to DataForSEO's live endpoints with the user's own login and password (Basic auth). Only
// live endpoints are used: an extension cannot receive a webhook, and polling a queued task would
// keep the service worker alive for minutes.
//
// Status codes, as DataForSEO documents them (the envelope and each task carry one):
//   20000 ok; 40102 no results, which is an empty answer, not a failure;
//   40100, 40101 and HTTP 401: the login or password is wrong;
//   40200, 40210 and HTTP 402: the balance cannot pay for the call;
//   40204 and HTTP 403: the account has no access to this API. This is what a Backlinks call
//     returns while the Backlinks subscription is not active;
//   40202, 40209 and HTTP 429: rate limited (requests per minute, or too many at once);
//   any other 4xxxx: the request was refused as invalid; 5xxxx and HTTP 5xx: unavailable.
import { toBase64 } from '../../secrets/base64'
import type { Paid, ProviderFailure } from '../failure'
import { ProviderError } from '../failure'
import { array, number, object } from '../json'
import type { PaidDeps } from '../paid'
import { paidCall } from '../paid'

export const DATAFORSEO_BASE_URL = 'https://api.dataforseo.com'

export interface DataForSeoCredentials {
  readonly login: string
  readonly password: string
}

export interface DataForSeoDeps extends PaidDeps {
  /** Read from the vault at call time; null when the user has not configured DataForSEO. */
  readonly credentials: () => Promise<DataForSeoCredentials | null>
}

const OK = 20000
const NO_RESULTS = 40102
const AUTH = new Set([40100, 40101])
const NO_FUNDS = new Set([40200, 40210])
const NO_ACCESS = 40204
const RATE_LIMITS = new Set([40202, 40209])
/** DataForSEO resets its per-minute limit within a minute. */
const RATE_RESET_S = 60

/**
 * Posts `body` as the one task of a live endpoint through the cache and the spend cap, and returns
 * the task's `result` array (empty for "no results").
 */
export async function liveTask(
  deps: DataForSeoDeps,
  endpoint: string,
  body: Readonly<Record<string, unknown>>,
  estimateUsd: number,
): Promise<Paid<readonly unknown[]>> {
  const paid = await paidCall(deps, 'dataforseo', endpoint, body, estimateUsd, async () => {
    const credentials = await deps.credentials()
    if (credentials === null) {
      throw new ProviderError({ code: 'not_configured', provider: 'dataforseo' })
    }
    return send(credentials, endpoint, body)
  })
  return { ...paid, data: array(paid.data) }
}

async function send(
  credentials: DataForSeoCredentials,
  endpoint: string,
  body: Readonly<Record<string, unknown>>,
) {
  const pair = new TextEncoder().encode(`${credentials.login}:${credentials.password}`)
  let response: Response
  try {
    response = await fetch(DATAFORSEO_BASE_URL + endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${toBase64(pair)}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify([body]),
    })
  } catch {
    throw new ProviderError({ code: 'unavailable', provider: 'dataforseo', status: null })
  }
  if (!response.ok) throw new ProviderError(httpFailure(response.status))
  let envelope: unknown
  try {
    envelope = await response.json()
  } catch {
    throw new ProviderError({ code: 'invalid_response', provider: 'dataforseo' })
  }
  const top = number(object(envelope)?.['status_code'])
  const task = object(array(object(envelope)?.['tasks'])[0])
  const status = top === OK ? number(task?.['status_code']) : top
  if (status === null) throw new ProviderError({ code: 'invalid_response', provider: 'dataforseo' })
  if (status !== OK && status !== NO_RESULTS) throw new ProviderError(statusFailure(status))
  // The envelope's cost covers the one task sent.
  const costUsd = number(object(envelope)?.['cost']) ?? 0
  return { response: status === NO_RESULTS ? [] : array(task?.['result']), costUsd }
}

function httpFailure(status: number): ProviderFailure {
  const provider = 'dataforseo'
  if (status === 401) return { code: 'auth_failed', provider }
  if (status === 402) return { code: 'no_funds', provider }
  if (status === 403) return { code: 'no_access', provider }
  if (status === 429) return { code: 'rate_limited', provider, retryAfterS: RATE_RESET_S }
  if (status >= 400 && status < 500) return { code: 'refused', provider, status }
  return { code: 'unavailable', provider, status }
}

function statusFailure(status: number): ProviderFailure {
  const provider = 'dataforseo'
  if (AUTH.has(status)) return { code: 'auth_failed', provider }
  if (NO_FUNDS.has(status)) return { code: 'no_funds', provider }
  if (status === NO_ACCESS) return { code: 'no_access', provider }
  if (RATE_LIMITS.has(status)) return { code: 'rate_limited', provider, retryAfterS: RATE_RESET_S }
  if (status >= 40000 && status < 50000) return { code: 'refused', provider, status }
  return { code: 'unavailable', provider, status }
}
