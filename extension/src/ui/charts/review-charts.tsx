import type { MonthTrend } from '@local-seo/core/reviews'
import styles from './charts.module.css'

const WIDTH = 320
const HEIGHT = 120
const PAD = { top: 12, right: 8, bottom: 20, left: 24 }

function monthName(month: string): string {
  const [year = '', number = '1'] = month.split('-')
  const name = new Date(Date.UTC(Number(year), Number(number) - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
  return `${name} ${year.slice(2)}`
}

/** Every month from the first to the last with reviews, so a silent month shows as a gap. */
export function filledMonths(monthly: readonly MonthTrend[]): (MonthTrend | { month: string })[] {
  const first = monthly[0]?.month
  const last = monthly.at(-1)?.month
  if (first === undefined || last === undefined) return []
  const byMonth = new Map(monthly.map((entry) => [entry.month, entry]))
  const months: (MonthTrend | { month: string })[] = []
  let [year, month] = first.split('-').map(Number) as [number, number]
  for (let guard = 0; guard < 240; guard += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    months.push(byMonth.get(key) ?? { month: key })
    if (key === last) break
    month += 1
    if (month > 12) [year, month] = [year + 1, 1]
  }
  return months
}

/** Reviews per month as thin bars from a shared baseline; the count shows on hover. */
export function MonthlyReviews({ monthly }: { readonly monthly: readonly MonthTrend[] }) {
  const months = filledMonths(monthly)
  const max = Math.max(1, ...monthly.map((entry) => entry.count))
  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const step = plotW / Math.max(1, months.length)
  const barW = Math.max(2, Math.min(14, step - 2))
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Reviews per month, ${monthName(months[0]?.month ?? '')} to ${monthName(
        months.at(-1)?.month ?? '',
      )}, at most ${max} in a month`}
    >
      <line
        className={styles.grid}
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={PAD.top}
        y2={PAD.top}
      />
      <text className={styles.axis} x={PAD.left - 4} y={PAD.top + 4} textAnchor="end">
        {max}
      </text>
      <line
        className={styles.baseline}
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={HEIGHT - PAD.bottom}
        y2={HEIGHT - PAD.bottom}
      />
      <text className={styles.axis} x={PAD.left - 4} y={HEIGHT - PAD.bottom + 4} textAnchor="end">
        0
      </text>
      {months.map((entry, at) => {
        const count = 'count' in entry ? entry.count : 0
        const h = (count / max) * plotH
        const x = PAD.left + at * step + (step - barW) / 2
        return (
          <g key={entry.month}>
            <title>{`${monthName(entry.month)}: ${count} reviews`}</title>
            <rect
              className={styles.hit}
              x={PAD.left + at * step}
              y={PAD.top}
              width={step}
              height={plotH}
            />
            {count === 0 ? null : (
              <path className={styles.bar} d={roundedTop(x, HEIGHT - PAD.bottom, barW, h)} />
            )}
          </g>
        )
      })}
      {[months[0], months.at(-1)].map((entry, at) =>
        entry === undefined ? null : (
          <text
            key={at}
            className={styles.axis}
            x={at === 0 ? PAD.left : WIDTH - PAD.right}
            y={HEIGHT - 6}
            textAnchor={at === 0 ? 'start' : 'end'}
          >
            {monthName(entry.month)}
          </text>
        ),
      )}
    </svg>
  )
}

/** Average rating of each month's reviews, on a fixed 1 to 5 scale so a dip is not exaggerated. */
export function MonthlyRating({ monthly }: { readonly monthly: readonly MonthTrend[] }) {
  const months = filledMonths(monthly)
  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const step = plotW / Math.max(1, months.length)
  const y = (rating: number) => PAD.top + ((5 - rating) / 4) * plotH
  const points = months.flatMap((entry, at) =>
    'averageRating' in entry
      ? [{ x: PAD.left + at * step + step / 2, y: y(entry.averageRating), entry }]
      : [],
  )
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Average rating of each month's reviews, 1 to 5"
    >
      {[5, 3, 1].map((rating) => (
        <g key={rating}>
          <line
            className={rating === 1 ? styles.baseline : styles.grid}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(rating)}
            y2={y(rating)}
          />
          <text className={styles.axis} x={PAD.left - 4} y={y(rating) + 4} textAnchor="end">
            {rating}
          </text>
        </g>
      ))}
      <polyline className={styles.line} points={points.map((p) => `${p.x},${p.y}`).join(' ')} />
      {points.map((point) => (
        <g key={point.entry.month}>
          <title>{ratingTitle(point.entry)}</title>
          <circle className={styles.dot} cx={point.x} cy={point.y} r={4} />
        </g>
      ))}
    </svg>
  )
}

function ratingTitle(entry: MonthTrend): string {
  const rating = entry.averageRating.toFixed(1)
  return `${monthName(entry.month)}: ${rating} from ${entry.count} reviews`
}

/** Reviews per star, five rows, five stars on top. */
export function StarDistribution({
  distribution,
}: {
  readonly distribution: readonly [number, number, number, number, number]
}) {
  const total = distribution.reduce((sum, count) => sum + count, 0)
  return (
    <ul className={styles.stars} aria-label="Reviews per star rating">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star - 1] ?? 0
        const share = total === 0 ? 0 : (count / total) * 100
        return (
          <li key={star} className={styles.starRow}>
            <span className={styles.starLabel}>{star} star</span>
            <span className={styles.starTrack} aria-hidden="true">
              <span className={styles.starFill} style={{ width: `${share}%` }} />
            </span>
            <span className={styles.starCount}>{count}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** A bar with its top corners rounded (4px) and its foot square on the baseline. */
function roundedTop(x: number, base: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height)
  const top = base - height
  return (
    `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}` +
    `Q${x + width},${top} ${x + width},${top + r}V${base}Z`
  )
}
