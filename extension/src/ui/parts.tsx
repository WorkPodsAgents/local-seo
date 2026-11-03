// Small pieces every Local SEO screen shares: a KPI tile that says "Not shown by Google" instead
// of 0, a segmented choice, and the reference a screen passes to the service worker.
import type { BusinessRef } from '@local-seo/core/bridge'
import type { Business, Known } from '@local-seo/core/business'
import { isMissing } from '@local-seo/core/business'
import type { ReactNode } from 'react'
import styles from './screens/screens.module.css'

/** One figure with its label; null shows the reason it is unknown, never a zero. */
export function Kpi({
  label,
  value,
  note,
  unknown = 'Not shown by Google',
}: {
  readonly label: string
  readonly value: ReactNode | null
  readonly note?: string | undefined
  readonly unknown?: string
}) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      {value === null ? (
        <span className={styles.unknownValue}>{unknown}</span>
      ) : (
        <span className={styles.kpiValue}>{value}</span>
      )}
      {note === undefined ? null : <span className={styles.kpiNote}>{note}</span>}
    </div>
  )
}

/** Figures side by side; `pairs` keeps four figures two by two at the panel's width. */
export function Kpis({
  children,
  pairs = false,
}: {
  readonly children: ReactNode
  readonly pairs?: boolean
}) {
  return <div className={pairs ? `${styles.kpis} ${styles.pairs}` : styles.kpis}>{children}</div>
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  readonly options: readonly { readonly id: T; readonly label: string }[]
  readonly value: T
  readonly onChange: (value: T) => void
  readonly label: string
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** How a tool is told about a business the panel has read: by its CID when known. */
export function refOf(business: Business): BusinessRef {
  if (business.ids.cid !== null) return { cid: business.ids.cid }
  if (business.ids.placeId !== null) return { placeId: business.ids.placeId }
  const city = isMissing(business.address) ? '' : (business.address.city ?? '')
  return { name: business.name, city }
}

export function known<T>(value: Known<T>): T | null {
  return isMissing(value) ? null : value
}

/** The reason a value is unknown, for a tooltip or a note. */
export function reasonOf<T>(value: Known<T>): string | null {
  return isMissing(value) ? value.reason : null
}

/** A website as people read it: host and path, without tracking parameters or a scheme. */
export function siteText(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return parsed.hostname.replace(/^www\./, '') + path
  } catch {
    return url
  }
}

export function count(value: number | null): string | null {
  return value === null ? null : value.toLocaleString('en-US')
}

export function percent(share: number | null): string | null {
  return share === null ? null : `${Math.round(share * 100)}%`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}
