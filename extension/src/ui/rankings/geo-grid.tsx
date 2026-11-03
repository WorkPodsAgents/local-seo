import { LIMITS, type GeoGridResult, type Source } from '@local-seo/core/bridge'
import type { Business } from '@local-seo/core/business'
import { isMissing } from '@local-seo/core/business'
import { useState } from 'react'
import type { PaidRequest } from '../../shared/api'
import { call, useEvent } from '../client'
import { Heatmap } from '../charts/heatmap'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { FieldRow, TextField } from '../components/field'
import { ErrorNote, Note } from '../components/notice'
import { PaidAction } from '../components/paid-action'
import { Kpi, Kpis, percent, refOf, Segmented } from '../parts'
import styles from '../screens/screens.module.css'
import { useTask } from '../use-task'
import fieldStyles from '../components/field.module.css'

/** A grid point takes a page load plus the pause between searches. */
const SECONDS_PER_POINT = 7

/** Where the business ranks across an area, free in this browser or from DataForSEO. */
export function GeoGridCard({
  business,
  defaultQuery,
}: {
  readonly business: Business
  readonly defaultQuery: string
}) {
  const [query, setQuery] = useState(defaultQuery)
  const [source, setSource] = useState<Source>('browser')
  const [size, setSize] = useState(5)
  const [spacing, setSpacing] = useState('1')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const grid = useTask<GeoGridResult>()
  useEvent('grid:progress', setProgress)
  const centre = isMissing(business.location) ? null : business.location
  const spacingKm = Number(spacing)
  const valid = centre !== null && query.trim() !== '' && spacingKm > 0 && spacingKm <= 50
  const args =
    centre === null
      ? null
      : { query, business: refOf(business), center: centre, size, spacingKm, source }
  const sizes = source === 'browser' ? [3, 5] : [3, 5, 7, 9, 11, 13]
  const running = grid.task.kind === 'running'
  const run = () => {
    if (args === null) return
    setProgress(null)
    void grid.run(() =>
      source === 'browser'
        ? call('local:geo_grid', args)
        : call('paid:geo_grid', args).then((paid) => paid.data),
    )
  }
  const request: PaidRequest | null = valid && args !== null ? { op: 'paid:geo_grid', args } : null
  const result = grid.value
  return (
    <Card
      title="Geo grid"
      subtitle="One Maps search from each point around the business, to see where it wins."
    >
      <TextField label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      <Segmented
        label="Where the searches run"
        value={source}
        onChange={(next) => {
          setSource(next)
          if (next === 'browser' && size > LIMITS.grid.browserMaxSize) setSize(5)
        }}
        options={[
          { id: 'browser', label: 'Free, in this browser' },
          { id: 'dataforseo', label: 'DataForSEO' },
        ]}
      />
      <FieldRow>
        <label className={fieldStyles.field}>
          <span className="ui-label">Grid</span>
          <select
            className={fieldStyles.input}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          >
            {sizes.map((option) => (
              <option key={option} value={option}>
                {option} x {option} ({option * option} points)
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Spacing, km"
          inputMode="decimal"
          value={spacing}
          onChange={(e) => setSpacing(e.target.value)}
        />
      </FieldRow>
      {centre === null ? (
        <ErrorNote>
          Google did not show this business's location, so a grid has no centre.
        </ErrorNote>
      ) : null}
      {source === 'browser' ? (
        <>
          <div className={styles.row}>
            <Button variant="primary" busy={running} disabled={!valid} onClick={run}>
              {running ? 'Reading the grid' : 'Run free grid'}
            </Button>
            {running ? (
              <Button onClick={() => void call('grid:stop', {})}>Stop</Button>
            ) : (
              <span className={styles.muted}>
                About {Math.ceil((size * size * SECONDS_PER_POINT) / 60)} min, in a background tab
              </span>
            )}
          </div>
          <Note>
            Searches run one at a time with a pause between them. If Google shows its unusual
            traffic page, the grid stops and the points left show as not read.
          </Note>
        </>
      ) : (
        <PaidAction request={request} label="Run paid grid" busy={running} onRun={run} />
      )}
      {running && progress !== null ? (
        <div
          className={styles.progress}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-label="Grid points read"
        >
          <span
            className={styles.progressFill}
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      ) : null}
      {grid.task.kind === 'failed' ? <ErrorNote>{grid.task.error}</ErrorNote> : null}
      {result === null || result.summary === null ? null : <GridResult result={result} />}
    </Card>
  )
}

function GridResult({ result }: { readonly result: GeoGridResult }) {
  const summary = result.summary
  if (summary === null) return null
  const read = summary.ranked + summary.notFound
  return (
    <>
      <Kpis>
        <Kpi
          label="Average rank"
          value={summary.averageRank === null ? null : summary.averageRank.toFixed(1)}
          unknown="Ranked nowhere"
          note={`Ranked at ${summary.ranked} of ${summary.points} points`}
        />
        <Kpi
          label="In the top 3"
          value={percent(summary.top3Share)}
          unknown="No point read"
          note={`Of ${read} points read`}
        />
        <Kpi label="Best" value={summary.best === null ? null : `#${summary.best}`} unknown="–" />
      </Kpis>
      <Heatmap cells={result.cells} />
      {summary.unknown > 0 ? (
        <Note>
          {summary.unknown} of {summary.points} points were not read. Hover a hatched cell to see
          why.
        </Note>
      ) : null}
      {result.spend === null ? null : (
        <Note>
          {result.spend.cached
            ? 'From your cache, at no cost.'
            : `Cost $${result.spend.usd.toFixed(3)}.`}
        </Note>
      )}
    </>
  )
}
