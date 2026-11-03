import type { ReactNode } from 'react'
import styles from './table.module.css'

export interface Column<T> {
  readonly label: string
  readonly cell: (row: T) => ReactNode
  readonly numeric?: boolean
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  label,
  rowClass,
}: {
  readonly columns: readonly Column<T>[]
  readonly rows: readonly T[]
  readonly rowKey: (row: T) => string
  readonly label: string
  /** Marks a row, such as the user's own business among competitors. */
  readonly rowClass?: (row: T) => string | undefined
}) {
  const cellClass = (column: Column<T>) =>
    column.numeric === true ? `${styles.td} ${styles.numeric}` : styles.td
  return (
    <div className={styles.scroller}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={column.numeric === true ? `${styles.th} ${styles.numeric}` : styles.th}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={`${styles.tr} ${rowClass?.(row) ?? ''}`}>
              {columns.map((column) => (
                <td key={column.label} className={cellClass(column)}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
