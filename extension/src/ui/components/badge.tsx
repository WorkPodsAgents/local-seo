import type { Severity, Status } from '@open-agent-ready/core'
import type { ReactNode } from 'react'
import styles from './badge.module.css'
import { SEVERITY_LABEL, SEVERITY_TONE, STATUS_LABEL, statusTone, type Tone } from './tone'

export function Badge({ tone, children }: { readonly tone: Tone; readonly children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}

export function SeverityBadge({ severity }: { readonly severity: Severity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
}

export function Dot({ tone }: { readonly tone: Tone }) {
  return <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />
}

/** The checklist's verdict mark: a filled circle with a tick, a cross, a half, or a ring. */
export function StatusMark({
  status,
  severity,
}: {
  readonly status: Status
  readonly severity: Severity | null
}) {
  return (
    <svg
      className={`${styles.mark} ${styles[statusTone(status, severity)]}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      role="img"
      aria-label={STATUS_LABEL[status]}
    >
      {status === 'not_applicable' || status === 'partial' ? (
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      ) : (
        <circle cx="8" cy="8" r="7" fill="currentColor" />
      )}
      {status === 'pass' ? (
        <path d="M4.8 8.2 7 10.3l4.2-4.6" fill="none" stroke="var(--surface)" strokeWidth="1.6" />
      ) : null}
      {status === 'fail' ? (
        <path d="m5.5 5.5 5 5m0-5-5 5" stroke="var(--surface)" strokeWidth="1.6" />
      ) : null}
      {status === 'partial' ? (
        <path d="M8 1.75a6.25 6.25 0 0 0 0 12.5Z" fill="currentColor" />
      ) : null}
    </svg>
  )
}
