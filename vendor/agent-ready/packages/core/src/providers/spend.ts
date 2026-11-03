// The monthly spend cap per paid provider. Every paid call first reserves its estimate here and is
// refused when that would pass the cap; once the provider answers, the reservation settles to the
// cost the response reports. Amounts are kept in integer micro-dollars so many small charges add
// up exactly. Months are calendar months in UTC.
import type { Provider, ProviderFailure } from './failure'
import { ProviderError } from './failure'
import type { Clock, KeyValueStore } from './store'
import { serialized } from './store'

const PROVIDERS: readonly Provider[] = ['dataforseo', 'cloro']

export interface ProviderSpend {
  /** Null until the user sets a cap; no paid call runs without one. */
  readonly capUsd: number | null
  readonly spentUsd: number
  /** Estimates of calls still in flight. */
  readonly reservedUsd: number
}

export interface SpendSummary {
  /** `YYYY-MM`, UTC. */
  readonly month: string
  readonly providers: Readonly<Record<Provider, ProviderSpend>>
}

/** An authorized estimate. Settle it with the reported cost, or release it if nothing was spent. */
export interface Reservation {
  settle(actualUsd: number): Promise<void>
  release(): void
}

export interface SpendLedger {
  setCap(provider: Provider, capUsd: number): Promise<void>
  summary(): Promise<SpendSummary>
  /** Reserves `estimatedUsd`; throws ProviderError cap_not_set or over_cap. */
  authorize(provider: Provider, estimatedUsd: number): Promise<Reservation>
}

const KEY = 'spend'
const MICROS = 1_000_000

interface Stored {
  readonly month: string
  readonly spent: Readonly<Partial<Record<Provider, number>>>
  readonly caps: Readonly<Partial<Record<Provider, number>>>
}

export function createSpendLedger(deps: {
  readonly storage: KeyValueStore
  readonly clock: Clock
}): SpendLedger {
  const exclusive = serialized()
  const reserved: Record<Provider, number> = { dataforseo: 0, cloro: 0 }

  async function load(): Promise<Stored> {
    const month = monthOf(deps.clock())
    const stored = parse(await deps.storage.get(KEY))
    if (stored === null) return { month, spent: {}, caps: {} }
    // A new month starts from nothing spent; the caps carry over.
    return stored.month === month ? stored : { month, spent: {}, caps: stored.caps }
  }

  return {
    setCap: (provider, capUsd) =>
      exclusive(async () => {
        if (!(capUsd >= 0))
          throw new ProviderError({ code: 'invalid_input', provider, field: 'cap' })
        const stored = await load()
        await deps.storage.set(KEY, {
          ...stored,
          caps: { ...stored.caps, [provider]: toMicros(capUsd) },
        })
      }),

    summary: () =>
      exclusive(async () => {
        const stored = await load()
        const entry = (provider: Provider): ProviderSpend => {
          const cap = stored.caps[provider]
          return {
            capUsd: cap === undefined ? null : cap / MICROS,
            spentUsd: (stored.spent[provider] ?? 0) / MICROS,
            reservedUsd: reserved[provider] / MICROS,
          }
        }
        return {
          month: stored.month,
          providers: { dataforseo: entry('dataforseo'), cloro: entry('cloro') },
        }
      }),

    authorize: (provider, estimatedUsd) =>
      exclusive(async () => {
        const stored = await load()
        const cap = stored.caps[provider]
        if (cap === undefined) throw new ProviderError({ code: 'cap_not_set', provider })
        const estimate = toMicros(estimatedUsd)
        const committed = (stored.spent[provider] ?? 0) + reserved[provider]
        if (committed + estimate > cap) {
          const failure: ProviderFailure = {
            code: 'over_cap',
            provider,
            capUsd: cap / MICROS,
            spentUsd: committed / MICROS,
            estimateUsd: estimate / MICROS,
          }
          throw new ProviderError(failure)
        }
        reserved[provider] += estimate
        let open = true
        const release = () => {
          if (open) reserved[provider] -= estimate
          open = false
        }
        return {
          release,
          settle: (actualUsd) =>
            exclusive(async () => {
              release()
              const current = await load()
              const spent = (current.spent[provider] ?? 0) + toMicros(actualUsd)
              await deps.storage.set(KEY, {
                ...current,
                spent: { ...current.spent, [provider]: spent },
              })
            }),
        }
      }),
  }
}

/** Rounded up, so the ledger never shows less than the provider charged. */
function toMicros(usd: number): number {
  return Math.max(0, Math.ceil(Math.round(usd * MICROS * 1000) / 1000))
}

function monthOf(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 7)
}

function parse(value: unknown): Stored | null {
  if (typeof value !== 'object' || value === null) return null
  const { month, spent, caps } = value as Record<string, unknown>
  if (typeof month !== 'string') return null
  return { month, spent: amounts(spent), caps: amounts(caps) }
}

function amounts(value: unknown): Partial<Record<Provider, number>> {
  const result: Partial<Record<Provider, number>> = {}
  if (typeof value !== 'object' || value === null) return result
  const record = value as Record<string, unknown>
  for (const provider of PROVIDERS) {
    const amount = record[provider]
    if (typeof amount === 'number' && Number.isFinite(amount)) result[provider] = amount
  }
  return result
}
