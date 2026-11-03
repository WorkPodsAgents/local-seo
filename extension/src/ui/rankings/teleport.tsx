import { LIMITS, type FindBusinessResult, type Near } from '@local-seo/core/bridge'
import type { Business, RankedBusiness } from '@local-seo/core/business'
import { isMissing } from '@local-seo/core/business'
import { rankIn, type PointRank } from '@local-seo/core/geo'
import { useState } from 'react'
import { call } from '../client'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { TextField } from '../components/field'
import { ErrorNote } from '../components/notice'
import { Table } from '../components/table'
import { count } from '../parts'
import styles from '../screens/screens.module.css'
import { useTask } from '../use-task'

const POINT = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

/** "53.80, -1.55" is a point; anything else is a place name Maps looks up. */
export function nearOf(text: string): Near {
  const match = POINT.exec(text)
  return match === null ? text.trim() : { lat: Number(match[1]), lng: Number(match[2]) }
}

interface Teleported {
  readonly found: FindBusinessResult
  readonly rank: PointRank
}

/** Teleport: one Maps search as if the customer stood somewhere else. */
export function TeleportCard({
  business,
  defaultQuery,
}: {
  readonly business: Business
  readonly defaultQuery: string
}) {
  const [query, setQuery] = useState(defaultQuery)
  const [where, setWhere] = useState(() =>
    isMissing(business.location)
      ? ''
      : `${business.location.lat.toFixed(5)}, ${business.location.lng.toFixed(5)}`,
  )
  const teleport = useTask<Teleported>()
  const run = () =>
    void teleport.run(async () => {
      const found = await call('local:find_business', { query, near: nearOf(where) })
      return { found, rank: rankIn(found.candidates, business, LIMITS.rankDepth) }
    })
  const result = teleport.value
  return (
    <Card
      title="Teleport"
      subtitle="Search Maps as if you stood somewhere else: a town, a street, or a point."
    >
      <TextField label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      <TextField
        label="From"
        placeholder="Leeds, UK  or  53.8008, -1.5491"
        hint="A place name, or a point as lat, lng"
        value={where}
        onChange={(e) => setWhere(e.target.value)}
      />
      <div className={styles.row}>
        <Button
          variant="primary"
          busy={teleport.task.kind === 'running'}
          disabled={query.trim() === '' || where.trim() === ''}
          onClick={run}
        >
          {teleport.task.kind === 'running' ? 'Searching' : 'Check rank'}
        </Button>
      </div>
      {teleport.task.kind === 'failed' ? <ErrorNote>{teleport.task.error}</ErrorNote> : null}
      {result === null ? null : <TeleportResult business={business} result={result} />}
    </Card>
  )
}

function TeleportResult({
  business,
  result,
}: {
  readonly business: Business
  readonly result: Teleported
}) {
  const { rank, found } = result
  const [all, setAll] = useState(false)
  // The business and the top ten say enough; the rest of the 20 opens on request.
  const mine = found.candidates.findIndex((row) => row.name === business.name)
  const shown = all ? found.candidates : found.candidates.slice(0, Math.max(10, mine + 1))
  const from =
    found.from === null ? 'Maps view' : `${found.from.lat.toFixed(4)}, ${found.from.lng.toFixed(4)}`
  return (
    <>
      <div className={styles.rankHero}>
        <span className={styles.rankNumber}>
          {rank.kind === 'ranked' ? `#${rank.rank}` : rank.kind === 'not_found' ? '20+' : '?'}
        </span>
        <span className={styles.muted}>
          {rank.kind === 'ranked'
            ? `for “${found.query}” from ${from}`
            : rank.kind === 'not_found'
              ? `Not in the top ${rank.depth} for “${found.query}” from ${from}`
              : rank.reason}
        </span>
      </div>
      <Table<RankedBusiness>
        label="Results at that point"
        rows={shown}
        rowKey={(row) => `${row.position}-${row.name}-${row.sponsored}`}
        rowClass={(row) => (row.name === business.name ? styles.mine : undefined)}
        columns={[
          {
            label: '#',
            numeric: true,
            cell: (row) => (row.sponsored ? <Badge tone="neutral">Ad</Badge> : row.position),
          },
          { label: 'Business', cell: (row) => row.name },
          {
            label: 'Rating',
            numeric: true,
            cell: (row) => (row.rating === null ? '–' : row.rating.toFixed(1)),
          },
          { label: 'Reviews', numeric: true, cell: (row) => count(row.reviewCount) ?? '–' },
        ]}
      />
      {shown.length < found.candidates.length ? (
        <div>
          <Button variant="ghost" onClick={() => setAll(true)}>
            Show all {found.candidates.length}
          </Button>
        </div>
      ) : null}
    </>
  )
}
