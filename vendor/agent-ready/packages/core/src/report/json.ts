// The machine-readable report, in the same order as the Markdown, for CI and for agents.
import type { Evidence, Finding } from '../model'
import { check } from '../registry'
import type { Report } from './report'
import { countByStatus, rubricLine, sections } from './order'

interface FindingJson extends Omit<Finding, 'evidence'> {
  readonly title: string
  /** The registry's rubric line for this severity; null on pass and not applicable. */
  readonly rubric: string | null
  readonly evidence: readonly Evidence[]
}

export function toJson(report: Report): string {
  const findings: FindingJson[] = sections(report.findings).flatMap((layer) =>
    layer.groups.flatMap((group) => group.findings.map(findingJson)),
  )
  const crawl =
    report.kind === 'site'
      ? { pagesCrawled: report.pagesCrawled, stopReason: report.stopReason }
      : {}
  const body = {
    kind: report.kind,
    url: report.url,
    ...crawl,
    counts: countByStatus(report.findings),
    notes: report.notes,
    findings,
  }
  return JSON.stringify(body, null, 2) + '\n'
}

function findingJson(finding: Finding): FindingJson {
  return { ...finding, title: check(finding.checkId).title, rubric: rubricLine(finding) }
}
