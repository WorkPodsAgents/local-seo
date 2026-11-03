// Reviews and posts have no live endpoint at DataForSEO, only a queue: post a task, then poll it.
// The vendored liveTask covers live endpoints; this is its queued twin, through the same cache and
// spend cap. Polling waits through the injected Sleep so tests never sleep.
//
// Codes beyond those liveTask documents: 20100 task created; 40601 "Task Handed" and 40602
// "Task In Queue" while it waits (https://docs.dataforseo.com/v3/appendix/errors/).
import type { Sleep } from '@open-agent-ready/core'
import type { DataForSeoDeps } from '@open-agent-ready/core/providers'
import { ProviderError } from '@open-agent-ready/core/providers'
import type { Paid, ProviderFailure, ResponseCache } from '@open-agent-ready/core/providers'
// Not exported by the vendored package's entry points; deep imports keep vendor/ untouched.
import { toBase64 } from '../../../../../vendor/agent-ready/packages/core/src/secrets/base64'
import {
  array,
  number,
  object,
  text,
} from '../../../../../vendor/agent-ready/packages/core/src/providers/json'
import type { Charged } from '../../../../../vendor/agent-ready/packages/core/src/providers/paid'
import {
  DATAFORSEO_BASE_URL,
  liveTask,
} from '../../../../../vendor/agent-ready/packages/core/src/providers/dataforseo/http'
import { paidCall } from '../../../../../vendor/agent-ready/packages/core/src/providers/paid'

/** Live endpoints go through the vendored liveTask unchanged. */
export { liveTask }

export interface QueuedDeps extends DataForSeoDeps {
  readonly sleep: Sleep
  /**
   * Task ids already paid for, keyed by the request. DataForSEO keeps a task's result for 30
   * days, so keep these as long: a retry after a failed poll fetches the paid task again
   * instead of posting (and paying for) a new one.
   */
  readonly taskIds: ResponseCache
  /** Wait between polls; defaults to 5 s. */
  readonly pollMs?: number
  /** Polls before giving up; defaults to 60 (5 minutes at the default wait). */
  readonly maxPolls?: number
}

/** How long DataForSEO keeps a task's result, and so how long its id is worth keeping. */
export const TASK_LIFE_MS = 30 * 24 * 60 * 60 * 1000

const OK = 20000
const CREATED = 20100
const NO_RESULTS = 40102
const WAITING = new Set([40601, 40602])
const RATE_RESET_S = 60

/**
 * Posts `body` as one task to `<base>/task_post`, polls `<base>/task_get/<id>` until it is done,
 * and returns the task's `result` array (empty for "no results").
 *
 * Posting is the paid step, so it runs alone through the spend cap: once DataForSEO accepts the
 * task its cost is settled (the estimate when the answer reports none) and its id kept, even if
 * polling fails afterwards. Polling is free and never posts again.
 */
export async function queuedTask(
  deps: QueuedDeps,
  base: string,
  body: Readonly<Record<string, unknown>>,
  estimateUsd: number,
): Promise<Paid<readonly unknown[]>> {
  const hit = await deps.cache.get('dataforseo', base, body)
  if (hit !== undefined) return { data: array(hit), costUsd: 0, cached: true }
  const auth = await authorization(deps)
  const postDeps = { ledger: deps.ledger, cache: deps.taskIds }
  const posted = await paidCall(
    postDeps,
    'dataforseo',
    `${base}/task_post`,
    body,
    estimateUsd,
    () => postTask(auth, base, body, estimateUsd),
  )
  const id = text(object(posted.data)?.['id'])
  if (id === null) throw new ProviderError({ code: 'invalid_response', provider: 'dataforseo' })
  const result = await poll(deps, auth, `${base}/task_get/${encodeURIComponent(id)}`)
  await deps.cache.put('dataforseo', base, body, result)
  return { data: result, costUsd: posted.costUsd, cached: false }
}

async function postTask(
  auth: string,
  base: string,
  body: Readonly<Record<string, unknown>>,
  estimateUsd: number,
): Promise<Charged> {
  const posted = await call(auth, `${base}/task_post`, [body])
  if (posted.status !== CREATED && posted.status !== OK) {
    throw new ProviderError(statusFailure(posted.status))
  }
  const id = text(posted.task?.['id'])
  if (id === null) throw new ProviderError({ code: 'invalid_response', provider: 'dataforseo' })
  return { response: { id }, costUsd: posted.costUsd ?? estimateUsd }
}

/** The Basic auth header from the vault's credentials; not_configured when there are none. */
async function authorization(deps: DataForSeoDeps): Promise<string> {
  const credentials = await deps.credentials()
  if (credentials === null) {
    throw new ProviderError({ code: 'not_configured', provider: 'dataforseo' })
  }
  const pair = new TextEncoder().encode(`${credentials.login}:${credentials.password}`)
  return `Basic ${toBase64(pair)}`
}

async function poll(deps: QueuedDeps, auth: string, path: string): Promise<readonly unknown[]> {
  const maxPolls = deps.maxPolls ?? 60
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    await deps.sleep(deps.pollMs ?? 5000)
    const got = await call(auth, path, null)
    if (got.status === OK) return array(got.task?.['result'])
    if (got.status === NO_RESULTS) return []
    if (!WAITING.has(got.status)) throw new ProviderError(statusFailure(got.status))
  }
  // The task was paid for and its id kept, so a later call fetches it without posting again.
  throw new ProviderError({ code: 'unavailable', provider: 'dataforseo', status: null })
}

interface Answer {
  readonly status: number
  readonly task: Readonly<Record<string, unknown>> | null
  /** Null when the answer reports no cost. */
  readonly costUsd: number | null
}

/** POSTs `body`, or GETs when it is null; returns the first task's status. */
async function call(auth: string, path: string, body: unknown): Promise<Answer> {
  let response: Response
  try {
    response = await fetch(DATAFORSEO_BASE_URL + path, {
      method: body === null ? 'GET' : 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      ...(body === null ? {} : { body: JSON.stringify(body) }),
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
  return { status, task, costUsd: number(object(envelope)?.['cost']) }
}

// The same mapping liveTask applies; vendored privately there, so repeated here.
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
  if (status === 40100 || status === 40101) return { code: 'auth_failed', provider }
  if (status === 40200 || status === 40210) return { code: 'no_funds', provider }
  if (status === 40204) return { code: 'no_access', provider }
  if (status === 40202 || status === 40209) {
    return { code: 'rate_limited', provider, retryAfterS: RATE_RESET_S }
  }
  if (status >= 40000 && status < 50000) return { code: 'refused', provider, status }
  return { code: 'unavailable', provider, status }
}
