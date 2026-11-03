import { useEffect, useState } from 'react'
import type { Cost, PaidRequest } from '../../shared/api'
import { capVerdict, formatUsd, PROVIDER_LABEL } from '../../shared/cost'
import type { Status } from '../../shared/settings'
import { call } from '../client'
import { useOpenSettings, type SettingsSection } from '../open-settings'
import { useStatus } from '../status-context'
import { Badge } from './badge'
import { Button } from './button'
import styles from './paid-action.module.css'

/**
 * A paid action's button with its estimated cost beside it. It refuses to run, and says why,
 * when the vault is locked, the provider has no keys or no cap, or the estimate passes the cap.
 */
export function PaidAction({
  request,
  label,
  busy,
  onRun,
}: {
  readonly request: PaidRequest | null
  readonly label: string
  readonly busy: boolean
  readonly onRun: () => void
}) {
  const { status } = useStatus()
  const openSettings = useOpenSettings()
  const cost = useEstimate(request)
  const blocked = cost === null || status === null ? null : blockedReason(cost, status)
  return (
    <div className={styles.action}>
      <Button
        variant="primary"
        busy={busy}
        disabled={request === null || cost === null || blocked !== null}
        onClick={onRun}
      >
        {label}
      </Button>
      {cost === null ? null : (
        <Badge tone={blocked === null ? 'info' : 'bad'}>
          About {formatUsd(cost.usd)} · {PROVIDER_LABEL[cost.provider]}
        </Badge>
      )}
      {blocked === null ? null : (
        <span className={styles.reason}>
          {blocked.text}{' '}
          {blocked.section === null ? null : (
            <button
              type="button"
              className={styles.link}
              onClick={() => openSettings(blocked.section ?? 'keys')}
            >
              Open settings
            </button>
          )}
        </span>
      )}
    </div>
  )
}

function useEstimate(request: PaidRequest | null): Cost | null {
  const [cost, setCost] = useState<Cost | null>(null)
  const key = JSON.stringify(request)
  useEffect(() => {
    if (request === null) {
      setCost(null)
      return
    }
    let current = true
    void call('estimate', request).then((next) => current && setCost(next))
    return () => {
      current = false
    }
    // The request is compared by value; a new object with the same fields is the same estimate.
  }, [key])
  return cost
}

interface Blocked {
  readonly text: string
  /** Where the user fixes it; null when only next month or a smaller request will. */
  readonly section: SettingsSection | null
}

export function blockedReason(cost: Cost, status: Status): Blocked | null {
  const name = PROVIDER_LABEL[cost.provider]
  if (status.vault !== 'unlocked') {
    const text =
      status.vault === 'empty'
        ? `Set up the key vault and add your ${name} credentials.`
        : 'Unlock the vault to use your keys.'
    return { text, section: 'vault' }
  }
  const keys =
    cost.provider === 'dataforseo' ? ['dataforseo_login', 'dataforseo_password'] : ['cloro_key']
  if (!keys.every((key) => status.stored.some((stored) => stored === key))) {
    return { text: `Add your ${name} credentials.`, section: 'keys' }
  }
  const verdict = capVerdict(cost.usd, status.spend.providers[cost.provider])
  switch (verdict.kind) {
    case 'no_cap':
      return { text: `Set a monthly ${name} cap first.`, section: 'spend' }
    case 'over': {
      const left = formatUsd(verdict.remainingUsd)
      return { text: `Over this month's cap: ${left} left of the ${name} cap.`, section: 'spend' }
    }
    case 'fits':
      return null
  }
}
