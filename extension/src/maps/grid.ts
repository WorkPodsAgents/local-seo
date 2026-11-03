// A geo grid, one point at a time. The browser source reads Maps from the scratch tab with a
// pause between searches, so a 5x5 grid looks like a person panning the map; the moment Google
// shows its "unusual traffic" page the grid stops and every point left is unknown, with that
// reason. Nothing here tries to get past such a page.
import type { BusinessIds, RankedBusiness } from '@local-seo/core/business'
import type { GridCell, GridPoint, PointRank } from '@local-seo/core/geo'
import { rankIn } from '@local-seo/core/geo'
import type { ListStop } from '../readers/paging'

export type PointRead =
  | {
      readonly kind: 'results'
      readonly results: readonly RankedBusiness[]
      /** Why the Maps list read ended; null for a provider's answer, which is the whole list. */
      readonly stoppedBy: ListStop | null
    }
  /** Reading must stop: Google refused, or the paid provider cannot go on. */
  | { readonly kind: 'blocked'; readonly reason: string }

export interface GridRun {
  readonly points: readonly GridPoint[]
  readonly target: { readonly ids: BusinessIds; readonly name: string }
  readonly depth: number
  readonly read: (point: GridPoint) => Promise<PointRead>
  /** Wait between two searches; 0 for a paid source. */
  readonly pauseMs: number
  readonly sleep: (ms: number) => Promise<void>
  /** Checked before each point; true stops the grid with the rest unknown. */
  readonly stopped?: () => boolean
  readonly onCell?: (cell: GridCell, done: number) => void
}

export const STOPPED_BY_USER = 'The grid was stopped before this point was read.'

export async function runGrid(run: GridRun): Promise<GridCell[]> {
  const cells: GridCell[] = []
  let halt: string | null = null
  for (const [index, point] of run.points.entries()) {
    if (halt === null && run.stopped?.() === true) halt = STOPPED_BY_USER
    if (halt !== null) {
      cells.push({ point, rank: { kind: 'unknown', reason: halt } })
      continue
    }
    if (index > 0 && run.pauseMs > 0) await run.sleep(run.pauseMs)
    const cell = await readCell(run, point)
    if (cell.rank.kind === 'unknown' && cell.halts) halt = cell.rank.reason
    cells.push({ point, rank: cell.rank })
    run.onCell?.(cells[cells.length - 1] as GridCell, cells.length)
  }
  return cells
}

async function readCell(
  run: GridRun,
  point: GridPoint,
): Promise<{ rank: GridCell['rank']; halts: boolean }> {
  try {
    const read = await run.read(point)
    if (read.kind === 'blocked') {
      return { rank: { kind: 'unknown', reason: read.reason }, halts: true }
    }
    return { rank: pointRank(read.results, read.stoppedBy, run.target, run.depth), halts: false }
  } catch (error) {
    // One point that failed to load says nothing about the next; the grid goes on.
    const reason = error instanceof Error ? error.message : String(error)
    return { rank: { kind: 'unknown', reason }, halts: false }
  }
}

/**
 * Where the target ranks in a list read to `cap`. Not found is said only to the depth actually
 * read: a list Maps cut short, or one that never rendered, leaves the rank unknown with why,
 * since the business may sit just past what loaded.
 */
export function pointRank(
  results: readonly RankedBusiness[],
  stoppedBy: ListStop | null,
  target: { readonly ids: BusinessIds; readonly name: string },
  cap: number,
): PointRank {
  const organic = results.filter((result) => !result.sponsored).length
  const rank = rankIn(results, target, Math.min(cap, organic))
  if (rank.kind === 'ranked' || stoppedBy === null || organic >= cap) return rank
  const cut = cutShort(stoppedBy, organic)
  return cut === null ? rank : { kind: 'unknown', reason: cut }
}

function cutShort(stoppedBy: ListStop, organic: number): string | null {
  if (organic === 0) return 'Maps showed no results at this point before reading gave up.'
  switch (stoppedBy) {
    case 'want':
    case 'end':
      return null
    case 'no_list':
      return 'Maps showed no results list at this point.'
    case 'step_cap':
      return 'Maps was still loading results when reading stopped.'
    case 'limited_view':
      return (
        `Signed out of Google, Maps showed only ${organic} results here; sign in to Google ` +
        'in this browser to read further.'
      )
  }
}
