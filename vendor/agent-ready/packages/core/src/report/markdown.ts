// The readable report: what the CLI prints and what the extension exports as Markdown.
import type { Evidence, Finding } from '../model'
import { CHECK_GROUP_LABEL } from '../model'
import { check } from '../registry'
import type { Report } from './report'
import { LAYER_LABEL, STATUS_LABEL, countByStatus, isProblem, rubricLine, sections } from './order'

export function toMarkdown(report: Report): string {
  const lines: string[] = [`# ${title(report)}`, '', summaryLine(report)]
  for (const note of report.notes) lines.push('', `> ${note}`)
  for (const layer of sections(report.findings)) {
    lines.push('', `## ${LAYER_LABEL[layer.layer]}`)
    for (const group of layer.groups) {
      lines.push('', `### ${CHECK_GROUP_LABEL[group.group]}`, '')
      for (const finding of group.findings) lines.push(...findingLines(finding))
    }
  }
  return lines.join('\n') + '\n'
}

function title(report: Report): string {
  return report.kind === 'page' ? `Page report: ${report.url}` : `Site report: ${report.url}`
}

function summaryLine(report: Report): string {
  const counts = countByStatus(report.findings)
  const tally =
    `${counts.fail} failing, ${counts.partial} partly failing, ${counts.pass} passing, ` +
    `${counts.not_applicable} not applicable.`
  if (report.kind === 'page') return tally
  const crawled = `Crawled ${report.pagesCrawled} ${report.pagesCrawled === 1 ? 'page' : 'pages'}`
  const stop = report.stopReason === null ? '' : ` (stopped early: ${report.stopReason})`
  return `${crawled}${stop}. ${tally}`
}

function findingLines(finding: Finding): string[] {
  if (!isProblem(finding)) {
    return [`- ${STATUS_LABEL[finding.status]}: ${finding.summary} (\`${finding.checkId}\`)`]
  }
  const name = `${check(finding.checkId).title} (\`${finding.checkId}\`)`
  const label = `${STATUS_LABEL[finding.status]}, ${finding.severity ?? 'no severity'}`
  const lines = [`- **${label}:** ${name}. ${finding.summary}`]
  const rubric = rubricLine(finding)
  if (rubric !== null) lines.push(`  - What ${finding.severity} means: ${rubric}`)
  for (const evidence of finding.evidence) lines.push(`  - Where: ${whereText(evidence)}`)
  return lines
}

/** One evidence item as plain text: element, URL, quoted value and note, whichever it has. */
export function whereText(evidence: Evidence): string {
  const parts: string[] = []
  if (evidence.url !== undefined) parts.push(evidence.url)
  if (evidence.selector !== undefined) parts.push(`element \`${evidence.selector}\``)
  if (evidence.value !== undefined) parts.push(`found "${evidence.value}"`)
  if (evidence.note !== undefined) parts.push(evidence.note)
  return parts.join(', ')
}
