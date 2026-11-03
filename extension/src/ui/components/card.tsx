import type { ReactNode } from 'react'
import styles from './card.module.css'

export function Card({
  id,
  title,
  subtitle,
  actions,
  flush = false,
  children,
}: {
  /** Lets a link scroll the card into view. */
  readonly id?: string
  readonly title?: string
  readonly subtitle?: ReactNode
  readonly actions?: ReactNode
  /** Tables bleed to the card edge. */
  readonly flush?: boolean
  readonly children?: ReactNode
}) {
  return (
    <section id={id} className={flush ? `${styles.card} ${styles.flush}` : styles.card}>
      {title === undefined ? null : (
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>{title}</h2>
            {subtitle === undefined ? null : <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
