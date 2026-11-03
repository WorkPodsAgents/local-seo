// The order every report uses, so the Markdown, the JSON and the side panel agree: by layer, then
// by checklist group, and inside a group the worst problems first.
import type { CheckGroup, Finding, Layer, Status } from '../model'
import { CHECK_GROUP_LABEL } from '../model'
import { check } from '../registry'
import type { Severity } from '../registry'

export const LAYER_LABEL: Readonly<Record<Layer, string>> = {
  seo: 'SEO',
  geo: 'GEO',
  axo: 'AXO',
  aco: 'ACO',
}

export const STATUS_LABEL: Readonly<Record<Status, string>> = {
  fail: 'Fail',
  partial: 'Partial',
  pass: 'Pass',
  not_applicable: 'Not applicable',
}

const LAYERS: readonly Layer[] = ['seo', 'geo', 'axo', 'aco']
const GROUPS = Object.keys(CHECK_GROUP_LABEL) as CheckGroup[]
const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}
const STATUS_RANK: Readonly<Record<Status, number>> = {
  fail: 0,
  partial: 1,
  pass: 2,
  not_applicable: 3,
}

export function isProblem(finding: Finding): boolean {
  return finding.status === 'fail' || finding.status === 'partial'
}

/** Problems by severity (a fail before a partial of the same severity), then passes, then n/a. */
function urgency(a: Finding, b: Finding): number {
  if (isProblem(a) && isProblem(b)) {
    const bySeverity = severityRank(a) - severityRank(b)
    if (bySeverity !== 0) return bySeverity
  }
  return STATUS_RANK[a.status] - STATUS_RANK[b.status]
}

function severityRank(finding: Finding): number {
  return finding.severity === null ? SEVERITY_RANK.low + 1 : SEVERITY_RANK[finding.severity]
}

export interface GroupSection {
  readonly group: CheckGroup
  readonly findings: readonly Finding[]
}

export interface LayerSection {
  readonly layer: Layer
  readonly groups: readonly GroupSection[]
}

/** Sections in report order, leaving out layers and groups with no findings. */
export function sections(findings: readonly Finding[]): LayerSection[] {
  return LAYERS.map((layer) => ({
    layer,
    groups: GROUPS.map((group) => ({
      group,
      findings: findings
        .filter((finding) => finding.layer === layer && finding.group === group)
        .sort(urgency),
    })).filter((section) => section.findings.length > 0),
  })).filter((section) => section.groups.length > 0)
}

/** The registry's rubric line for the finding's severity, or null on pass and not applicable. */
export function rubricLine(finding: Finding): string | null {
  return finding.severity === null ? null : check(finding.checkId).rubric[finding.severity]
}

export type StatusCounts = Readonly<Record<Status, number>>

export function countByStatus(findings: readonly Finding[]): StatusCounts {
  const counts: Record<Status, number> = { fail: 0, partial: 0, pass: 0, not_applicable: 0 }
  for (const finding of findings) counts[finding.status] += 1
  return counts
}
