import type { ButtonHTMLAttributes } from 'react'
import styles from './button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary',
  busy = false,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: Variant
  /** Disables the button while its action runs, so a second click cannot start it twice. */
  readonly busy?: boolean
}) {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles[variant]}`}
      disabled={busy || disabled === true}
      aria-busy={busy}
      {...rest}
    >
      {children}
    </button>
  )
}
