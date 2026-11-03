import type { CategoryUse, ScanRow } from '@local-seo/core/compare'
import { scanCsv } from '@local-seo/core/compare'
import { useState } from 'react'
import type { ScanView } from '../../shared/local'
import { call, errorText } from '../client'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { Checkbox } from '../components/field'
import { Empty, ErrorNote, Note } from '../components/notice'
import { Table } from '../components/table'
import { ExportBar, fileName } from '../export-bar'
import { SearchPageNotice } from '../search-notice'
import { count, Kpi, Kpis, plural } from '../parts'
import styles from '../screens/screens.module.css'
import { useTask } from '../use-task'
import type { ActiveTab } from '../use-active-url'

/** Every business on the Maps results in front of the user side by side, and their categories. */
export function ScanScreen({
  tab,
  searchPage,
  ownName,
}: {
  readonly tab: ActiveTab | null
  /** On a Google results page, its search (null when it has none); undefined elsewhere. */
  readonly searchPage: string | null | undefined
  /** The audited business, highlighted when it is on the page. */
  readonly ownName: string | null
}) {
  const scan = useTask<ScanView>()
  const [overlay, setOverlay] = useState(false)
  const [overlayError, setOverlayError] = useState<string | null>(null)
  const readable = tab !== null && /^https:\/\/www\.google\.[a-z.]+\/maps/.test(tab.url)
  const run = () => {
    if (tab === null) return
    void scan.run(() => call('scan:tab', { tab, max: 20 }))
  }
  const toggle = (on: boolean) => {
    if (tab === null) return
    setOverlay(on)
    call('overlay:set', { tab, on }).then(
      () => setOverlayError(null),
      (error: unknown) => {
        setOverlay(!on)
        setOverlayError(errorText(error))
      },
    )
  }
  const view = scan.value
  const running = scan.task.kind === 'running'
  return (
    <div className={styles.stack}>
      {view === null && searchPage !== undefined ? (
        <SearchPageNotice query={searchPage} />
      ) : view === null ? (
        <Empty
          title={readable ? 'Scan this results page' : 'Search Google Maps first'}
          action={
            readable ? (
              <Button variant="primary" busy={running} onClick={run}>
                {running ? 'Scanning' : 'Scan this page'}
              </Button>
            ) : null
          }
        >
          Lays every business on the Maps results side by side: position, category, rating and
          reviews, and how often each category is used. Free, read from the page you see.
        </Empty>
      ) : (
        <>
          <Card
            title={`“${view.results.query}”`}
            subtitle={`${plural(view.rows.length, 'business', 'businesses')} on this page${
              view.truncated ? ', and Maps has more' : ''
            }`}
            actions={
              <Button busy={running} disabled={!readable} onClick={run}>
                {running ? 'Scanning' : 'Scan again'}
              </Button>
            }
          >
            <Kpis>
              <Kpi label="Median rating" value={median(view.rows.map((row) => row.rating))} />
              <Kpi
                label="Median reviews"
                value={count(median(view.rows.map((row) => row.reviewCount)))}
              />
              <Kpi label="Ads" value={String(view.rows.filter((row) => row.sponsored).length)} />
            </Kpis>
            <Checkbox
              label="Show categories on the map's result cards"
              checked={overlay}
              onChange={toggle}
            />
            {overlayError === null ? null : <ErrorNote>{overlayError}</ErrorNote>}
            {view.stoppedBy === 'limited_view' ? (
              <Note>Signed out of Google, Maps shows a shorter list. Sign in to see them all.</Note>
            ) : null}
          </Card>
          <Card title="Businesses" flush>
            <ScanTable rows={view.rows} ownName={ownName} />
            <p className={styles.footnote}>
              {view.results.from === null
                ? 'Distance is not shown: the address gave no map centre to measure from.'
                : 'Distance is in a straight line from the centre of the map you searched.'}
            </p>
          </Card>
          <CategoryCard
            uses={view.categoryFrequency}
            rows={view.rows.filter((r) => !r.sponsored)}
          />
          <Card title="Export" subtitle="Save the scan for a spreadsheet or an agent.">
            <div className={styles.chips}>
              <ExportBar
                files={[
                  {
                    label: 'CSV',
                    filename: fileName(view.results.query, 'scan', 'csv'),
                    mime: 'text/csv',
                    text: () => scanCsv(view.rows),
                  },
                  {
                    label: 'JSON',
                    filename: fileName(view.results.query, 'scan', 'json'),
                    mime: 'application/json',
                    text: () => JSON.stringify(view, null, 2),
                  },
                ]}
              />
            </div>
          </Card>
        </>
      )}
      {scan.task.kind === 'failed' ? <ErrorNote>{scan.task.error}</ErrorNote> : null}
    </div>
  )
}

export function ScanTable({
  rows,
  ownName,
}: {
  readonly rows: readonly ScanRow[]
  readonly ownName: string | null
}) {
  return (
    <Table<ScanRow>
      label="Businesses on the results page"
      rows={rows}
      rowKey={(row) => `${row.position}-${row.name}-${row.sponsored}`}
      rowClass={(row) => (row.name === ownName ? styles.mine : undefined)}
      columns={[
        {
          label: '#',
          numeric: true,
          cell: (row) => (row.sponsored ? <Badge tone="neutral">Ad</Badge> : row.position),
        },
        {
          label: 'Business',
          cell: (row) => (
            <>
              <strong>{row.name}</strong>
              <br />
              <span className={styles.muted}>{row.primaryCategory ?? 'Category not shown'}</span>
            </>
          ),
        },
        {
          label: 'Rating',
          numeric: true,
          cell: (row) => (row.rating === null ? '–' : row.rating.toFixed(1)),
        },
        { label: 'Reviews', numeric: true, cell: (row) => count(row.reviewCount) ?? '–' },
        {
          label: 'Distance',
          numeric: true,
          cell: (row) => (row.distanceKm === null ? '–' : `${row.distanceKm.toFixed(1)} km`),
        },
      ]}
    />
  )
}

function CategoryCard({
  uses,
  rows,
}: {
  readonly uses: readonly CategoryUse[]
  readonly rows: readonly ScanRow[]
}) {
  const known = rows.filter((row) => row.primaryCategory !== null).length
  return (
    <Card
      title="Categories in use"
      subtitle={
        `Across ${plural(known, 'business', 'businesses')} with a known category. ` +
        'The list shows primary categories only.'
      }
    >
      <ul className={styles.list} aria-label="Category frequency">
        {uses.map((use) => (
          <li key={use.category} className={styles.freqRow}>
            <span>{use.category}</span>
            <span className={styles.freqTrack} aria-hidden="true">
              <span className={styles.freqFill} style={{ width: `${use.share * 100}%` }} />
            </span>
            <span className={`${styles.numeric} ${styles.muted}`}>
              {use.usedBy} of {known}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function median(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null).sort((a, b) => a - b)
  if (known.length === 0) return null
  const middle = Math.floor(known.length / 2)
  return known.length % 2 === 1
    ? (known[middle] ?? null)
    : ((known[middle - 1] ?? 0) + (known[middle] ?? 0)) / 2
}
