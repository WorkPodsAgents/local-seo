import { LogoMark } from '../../../vendor/agent-ready/vendor/workpods/logo/logo-mark'
import { connections } from './connections'
import styles from './header.module.css'
import { useOpenSettings } from './open-settings'
import { useStatus } from './status-context'

export function Header({
  host,
  settingsOpen,
}: {
  readonly host: string | null
  readonly settingsOpen: boolean
}) {
  const { status } = useStatus()
  const openSettings = useOpenSettings()
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <LogoMark size={24} />
        <div className={styles.titles}>
          <span className={styles.name}>Local SEO</span>
          <span className={styles.site}>{host ?? 'No page open'}</span>
        </div>
        <button
          type="button"
          className={styles.settings}
          aria-pressed={settingsOpen}
          onClick={() => openSettings('vault')}
        >
          <GearIcon />
          Settings
        </button>
      </div>
      {status === null ? null : (
        <ul className={styles.chips} aria-label="Connections">
          {connections(status).map((connection) => (
            <li key={connection.name}>
              <button
                type="button"
                className={styles.chip}
                title={`${connection.name}: ${connection.state}. Open settings.`}
                aria-label={`${connection.name}: ${connection.state}. Open settings.`}
                onClick={() => openSettings(connection.section)}
              >
                <span className={`${styles.light} ${styles[connection.light]}`} />
                {connection.name}
                {connection.light === 'off' ? <span className={styles.add}>Set up</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}

const GEAR_SPOKES =
  'M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2' +
  'M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4'

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d={GEAR_SPOKES} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
