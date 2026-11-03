import type { ReactNode } from 'react'
import styles from './notice.module.css'

export function ErrorNote({ children }: { readonly children: ReactNode }) {
  return (
    <p className={styles.error} role="alert">
      {children}
    </p>
  )
}

export function Note({ children }: { readonly children: ReactNode }) {
  return <p className={styles.note}>{children}</p>
}

export function Empty({
  title,
  children,
  action,
}: {
  readonly title: string
  readonly children?: ReactNode
  readonly action?: ReactNode
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {children === undefined ? null : <p className={styles.note}>{children}</p>}
      {action}
    </div>
  )
}
