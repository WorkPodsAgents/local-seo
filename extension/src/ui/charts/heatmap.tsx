import type { GridCell, PointRank } from '@local-seo/core/geo'
import styles from './charts.module.css'

type Band = 'top' | 'page' | 'deep' | 'absent' | 'unknown'

const BAND_LABEL: Readonly<Record<Band, string>> = {
  top: 'Ranks 1 to 3',
  page: 'Ranks 4 to 10',
  deep: 'Ranks 11 to 20',
  absent: 'Not in the top 20',
  unknown: 'Not read',
}

export function bandOf(rank: PointRank): Band {
  if (rank.kind === 'unknown') return 'unknown'
  if (rank.kind === 'not_found') return 'absent'
  return rank.rank <= 3 ? 'top' : rank.rank <= 10 ? 'page' : 'deep'
}

function cellText(rank: PointRank): string {
  if (rank.kind === 'ranked') return String(rank.rank)
  return rank.kind === 'not_found' ? `${rank.depth}+` : '?'
}

function cellLabel(cell: GridCell): string {
  const where = `${cell.point.lat.toFixed(4)}, ${cell.point.lng.toFixed(4)}`
  const rank = cell.rank
  if (rank.kind === 'ranked') return `Rank ${rank.rank} at ${where}`
  if (rank.kind === 'not_found') return `Not in the top ${rank.depth} at ${where}`
  return `Not read at ${where}: ${rank.reason}`
}

/**
 * The grid as Maps searchers around the business see it, north at the top. Every cell carries
 * its rank as text and a full label, so the colour bands are never the only cue.
 */
export function Heatmap({ cells }: { readonly cells: readonly GridCell[] }) {
  const size = Math.round(Math.sqrt(cells.length))
  const middle = (size - 1) / 2
  return (
    <div className={styles.heatmapWrap}>
      <div
        className={styles.heatmap}
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Rank at each grid point, north row first"
      >
        {cells.map((cell) => {
          const centre = cell.point.row === middle && cell.point.col === middle
          const band = bandOf(cell.rank)
          return (
            <div
              key={`${cell.point.row}-${cell.point.col}`}
              role="gridcell"
              className={`${styles.cell} ${styles[band]} ${centre ? styles.centre : ''}`}
              aria-label={cellLabel(cell) + (centre ? ' (grid centre)' : '')}
              title={cellLabel(cell)}
            >
              {cellText(cell.rank)}
            </div>
          )
        })}
      </div>
      <ul className={styles.legend} aria-label="Legend">
        {(Object.keys(BAND_LABEL) as Band[]).map((band) => (
          <li key={band}>
            <span className={`${styles.swatch} ${styles[band]}`} aria-hidden="true" />
            {BAND_LABEL[band]}
          </li>
        ))}
      </ul>
    </div>
  )
}
