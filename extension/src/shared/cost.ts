import type { Provider, ProviderSpend } from '@open-agent-ready/core/providers'

export const PROVIDER_LABEL: Readonly<Record<Provider, string>> = {
  dataforseo: 'DataForSEO',
  cloro: 'Cloro',
}

/** "$0.012" where a tenth of a cent matters, "$1.50" above a dime. */
export function formatUsd(usd: number): string {
  if (usd === 0) return '$0'
  if (usd < 0.1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

export type CapVerdict =
  | { readonly kind: 'fits'; readonly remainingUsd: number }
  | { readonly kind: 'over'; readonly remainingUsd: number }
  | { readonly kind: 'no_cap' }

/** Whether a paid action fits under this month's cap, as the ledger will judge it. */
export function capVerdict(estimateUsd: number, spend: ProviderSpend): CapVerdict {
  if (spend.capUsd === null) return { kind: 'no_cap' }
  const remainingUsd = Math.max(0, spend.capUsd - spend.spentUsd - spend.reservedUsd)
  return estimateUsd <= remainingUsd
    ? { kind: 'fits', remainingUsd }
    : { kind: 'over', remainingUsd }
}
