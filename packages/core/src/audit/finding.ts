// A local check's outcome, in the shape Agent Ready's findings use, so the panel's components and
// the report read both.
import type { Evidence, Status } from '@open-agent-ready/core'
import type { Business, Known, Post, RankedBusiness, Review } from '../business'
import { isMissing } from '../business'
import type { ScanRow } from '../compare'
import type { WebsiteCheck } from '../nap'
import type { LocalGroup, LocalSeverity } from '../registry'
import { localCheck } from '../registry'

export type { Evidence, Status }

export interface LocalFinding {
  /** A local registry id, such as "L7". */
  readonly checkId: string
  readonly group: LocalGroup
  readonly status: Status
  /** The check's severity on fail and partial; null on pass and not applicable. */
  readonly severity: LocalSeverity | null
  readonly summary: string
  readonly evidence: readonly Evidence[]
}

/** What the audit can use beyond the profile; anything left out makes its checks not applicable. */
export interface AuditExtras {
  /** The moment the audit judges recency against. */
  readonly now: Date
  readonly reviews?: readonly Review[]
  /**
   * Set when `reviews` are not newest first (Maps' "Most relevant" sample): why recency is not
   * judged. Checks of how recent reviews and replies are then report it as not applicable.
   */
  readonly reviewsSample?: string
  readonly posts?: readonly Post[]
  /** Why the posts are unknown, when they were looked for but not read in full. */
  readonly postsUnknown?: string
  readonly website?: WebsiteCheck
  /** The businesses ranking for the target search, the target among them or not. */
  readonly competitors?: readonly ScanRow[]
  /** The search the business wants to rank for, such as "emergency plumber". */
  readonly keyword?: string
  /** Other businesses Maps lists at the same address. */
  readonly sameAddress?: readonly Pick<RankedBusiness, 'name' | 'ids'>[]
}

export type CheckFn = (business: Business, extras: AuditExtras) => LocalFinding

export function finding(
  checkId: string,
  status: Status,
  summary: string,
  evidence: readonly Evidence[] = [],
): LocalFinding {
  const check = localCheck(checkId)
  const problem = status === 'fail' || status === 'partial'
  return {
    checkId,
    group: check.group,
    status,
    severity: problem ? check.severity : null,
    summary,
    evidence,
  }
}

/** The not-applicable finding for a value the source could not give. */
export function unknown(checkId: string, what: string, reason: string): LocalFinding {
  return finding(checkId, 'not_applicable', `${what} was not read: ${reason}.`)
}

/** Presence of a profile field: pass when known, fail when the profile lists none, else unknown. */
export function presence<T>(
  checkId: string,
  value: Known<T>,
  what: string,
  shown: (value: T) => string,
): LocalFinding {
  if (!isMissing(value)) {
    return finding(checkId, 'pass', `${what} is listed.`, [{ value: shown(value) }])
  }
  if (value.absent === true) return finding(checkId, 'fail', `The profile lists no ${lower(what)}.`)
  return unknown(checkId, what, value.reason)
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** Grades `value` against "at least" thresholds: pass at `good`, partial at `min`, else fail. */
export function graded(value: number, min: number, good: number): Status {
  if (value >= good) return 'pass'
  return value >= min ? 'partial' : 'fail'
}

/** Words of a name, category or search: lower-cased, 3+ letters. */
export function wordsOf(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => word.length >= 3)
}

/** "plumber" and "plumbing" share a stem: compare the first five letters. */
export function sameStem(a: string, b: string): boolean {
  const length = Math.min(5, a.length, b.length)
  return length >= 3 && a.slice(0, length) === b.slice(0, length)
}
