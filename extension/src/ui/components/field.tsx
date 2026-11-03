import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import styles from './field.module.css'

export function TextField({
  label,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { readonly label: string; readonly hint?: string }) {
  const id = useId()
  return (
    <div className={styles.field}>
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className={styles.input} {...input} />
      {hint === undefined ? null : <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

export function TextArea({
  label,
  hint,
  ...input
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  readonly label: string
  readonly hint?: string
}) {
  const id = useId()
  return (
    <div className={styles.field}>
      <label className="ui-label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className={styles.input} {...input} />
      {hint === undefined ? null : <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  readonly label: ReactNode
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

/** Fields and their button on one line, wrapping on a narrow panel. */
export function FieldRow({ children }: { readonly children: ReactNode }) {
  return <div className={styles.row}>{children}</div>
}
