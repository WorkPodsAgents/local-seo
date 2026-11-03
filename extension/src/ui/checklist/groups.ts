import type { LocalFinding } from '@local-seo/core/audit'
import type { LocalGroup } from '@local-seo/core/registry'
import { LOCAL_GROUPS } from '@local-seo/core/registry'

const STATUS_ORDER = { fail: 0, partial: 1, pass: 2, not_applicable: 3 } as const
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const

export interface FindingGroup {
  readonly group: LocalGroup
  readonly findings: readonly LocalFinding[]
}

/** Findings by group in the registry's order, worst first inside each group. */
export function groupFindings(findings: readonly LocalFinding[]): FindingGroup[] {
  return LOCAL_GROUPS.flatMap((group) => {
    const inGroup = findings
      .filter((finding) => finding.group === group)
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (a.severity === null ? 3 : SEVERITY_ORDER[a.severity]) -
            (b.severity === null ? 3 : SEVERITY_ORDER[b.severity]),
      )
    return inGroup.length === 0 ? [] : [{ group, findings: inGroup }]
  })
}

/** "25 passed · 3 failing · 1 partial · 4 untested", leaving out the empty counts. */
export function countsLine(findings: readonly LocalFinding[]): string {
  const count = (status: LocalFinding['status']) =>
    findings.filter((finding) => finding.status === status).length
  return [
    `${count('pass')} passed`,
    count('fail') > 0 ? `${count('fail')} failing` : null,
    count('partial') > 0 ? `${count('partial')} partial` : null,
    count('not_applicable') > 0 ? `${count('not_applicable')} untested` : null,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}
