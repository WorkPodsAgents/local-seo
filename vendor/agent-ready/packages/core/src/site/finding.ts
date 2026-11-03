// Builds a Finding with the registry's severity, so a site or crawl check never restates it.
import type { CheckGroup, Evidence, Finding, Layer, Status } from '../model'
import { check } from '../registry'

export function finding(
  checkId: string,
  layer: Layer,
  group: CheckGroup,
  status: Status,
  summary: string,
  evidence: readonly Evidence[] = [],
): Finding {
  const judged = status === 'fail' || status === 'partial'
  return {
    checkId,
    layer,
    group,
    status,
    severity: judged ? check(checkId).defaultSeverity : null,
    summary,
    evidence,
  }
}

/** "1 page" or "3 pages". */
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}
