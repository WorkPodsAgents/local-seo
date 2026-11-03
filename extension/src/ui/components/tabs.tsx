import styles from './tabs.module.css'

export function Tabs<T extends string>({
  tabs,
  selected,
  onSelect,
  label,
}: {
  readonly tabs: readonly { readonly id: T; readonly label: string }[]
  readonly selected: T
  readonly onSelect: (id: T) => void
  readonly label: string
}) {
  const move = (from: number, step: number) => {
    const next = tabs[(from + step + tabs.length) % tabs.length]
    if (next !== undefined) onSelect(next.id)
  }
  // Settings opens from the header, so no tab may be selected; the first one then takes focus.
  const focusable = tabs.some((tab) => tab.id === selected) ? selected : tabs[0]?.id
  return (
    <div className={styles.list} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-controls={`panel-${tab.id}`}
          aria-selected={tab.id === selected}
          tabIndex={tab.id === focusable ? 0 : -1}
          className={styles.tab}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') move(index, 1)
            if (event.key === 'ArrowLeft') move(index, -1)
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
