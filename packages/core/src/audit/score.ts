// One number for a profile: severity-weighted, with checks that could not be judged left out and
// counted, so a score built on few checks says so.
import type { LocalSeverity } from '../registry'
import { localCheck } from '../registry'
import type { LocalFinding } from './finding'

const WEIGHT: Readonly<Record<LocalSeverity, number>> = { high: 3, medium: 2, low: 1 }
const CREDIT = { pass: 1, partial: 0.5, fail: 0 } as const

export interface ProfileScore {
  /** 0-100; null when no check could be judged. */
  readonly score: number | null
  readonly judged: number
  /** Not applicable: the input was missing or the check does not apply. */
  readonly untested: number
}

export function scoreOf(findings: readonly LocalFinding[]): ProfileScore {
  let earned = 0
  let possible = 0
  let judged = 0
  for (const entry of findings) {
    if (entry.status === 'not_applicable') continue
    const weight = WEIGHT[localCheck(entry.checkId).severity]
    earned += weight * CREDIT[entry.status]
    possible += weight
    judged += 1
  }
  return {
    score: possible === 0 ? null : Math.round((100 * earned) / possible),
    judged,
    untested: findings.length - judged,
  }
}
