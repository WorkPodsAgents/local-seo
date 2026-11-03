// A profile audit as one document: what the panel exports, the CLI prints and agents read.
import type { Evidence } from '@open-agent-ready/core'
import type { Business, Known } from '../business'
import { isMissing } from '../business'
import type { LocalFinding, ProfileAudit, ProfileScore } from '../audit'
import type { LocalGroup } from '../registry'
import { LOCAL_GROUP_LABEL, LOCAL_GROUPS, localCheck } from '../registry'

export interface BusinessSummary {
  readonly name: string
  readonly source: Business['source']
  readonly readAt: string
  readonly placeId: string | null
  readonly cid: string | null
  /** Each null when unknown. */
  readonly primaryCategory: string | null
  readonly address: string | null
  readonly phone: string | null
  readonly website: string | null
  readonly rating: number | null
  readonly reviewCount: number | null
}

export interface ReportFinding extends LocalFinding {
  readonly title: string
}

export interface Fix {
  readonly checkId: string
  readonly title: string
  readonly severity: NonNullable<LocalFinding['severity']>
  readonly fix: string
}

export interface ProfileReport {
  readonly business: BusinessSummary
  readonly score: ProfileScore
  readonly groups: readonly {
    readonly group: LocalGroup
    readonly label: string
    readonly findings: readonly ReportFinding[]
  }[]
  /** One per failing or partly failing check, high severity first, fails before partials. */
  readonly fixes: readonly Fix[]
}

const RANK = { high: 0, medium: 1, low: 2 } as const

export function profileReport(business: Business, audit: ProfileAudit): ProfileReport {
  const titled = audit.findings.map((entry) => ({
    ...entry,
    title: localCheck(entry.checkId).title,
  }))
  return {
    business: businessSummary(business),
    score: audit.score,
    groups: LOCAL_GROUPS.map((group) => ({
      group,
      label: LOCAL_GROUP_LABEL[group],
      findings: titled.filter((entry) => entry.group === group),
    })).filter((group) => group.findings.length > 0),
    fixes: titled
      .flatMap((entry) =>
        entry.severity === null
          ? []
          : [{ entry, severity: entry.severity, fix: localCheck(entry.checkId).fix }],
      )
      .sort(
        (a, b) =>
          RANK[a.severity] - RANK[b.severity] ||
          Number(a.entry.status === 'partial') - Number(b.entry.status === 'partial'),
      )
      .map(({ entry, severity, fix }) => ({
        checkId: entry.checkId,
        title: entry.title,
        severity,
        fix,
      })),
  }
}

function value<T>(known: Known<T>): T | null {
  return isMissing(known) ? null : known
}

/** The few facts every tool result names a business by; each null when unknown. */
export function businessSummary(business: Business): BusinessSummary {
  return {
    name: business.name,
    source: business.source,
    readAt: business.readAt,
    placeId: business.ids.placeId,
    cid: business.ids.cid,
    primaryCategory: value(business.categories.primary),
    address: value(business.address)?.formatted ?? null,
    phone: value(business.phone),
    website: value(business.website),
    rating: value(business.rating),
    reviewCount: value(business.reviewCount),
  }
}

const STATUS_LABEL = {
  pass: 'Pass',
  partial: 'Partly fails',
  fail: 'Fails',
  not_applicable: 'Not checked',
} as const

export function reportMarkdown(report: ProfileReport): string {
  const { business, score } = report
  const lines = [`# Profile audit: ${business.name}`, '']
  const scoreText =
    score.score === null ? 'no score (nothing could be judged)' : `${score.score}/100`
  lines.push(
    `Score ${scoreText} from ${score.judged} checks; ${score.untested} not checked.`,
    '',
    ...facts(business),
  )
  if (report.fixes.length > 0) {
    lines.push('', '## Fixes, most important first', '')
    report.fixes.forEach((fix, at) => {
      lines.push(`${at + 1}. **${fix.title}** (${fix.severity}, \`${fix.checkId}\`): ${fix.fix}`)
    })
  }
  for (const group of report.groups) {
    lines.push('', `## ${group.label}`, '')
    for (const entry of group.findings) {
      const severity = entry.severity === null ? '' : `, ${entry.severity}`
      lines.push(
        `- ${STATUS_LABEL[entry.status]}${severity}: ${entry.title} (\`${entry.checkId}\`). ` +
          entry.summary,
      )
      for (const evidence of entry.evidence) lines.push(`  - ${evidenceText(evidence)}`)
    }
  }
  return lines.join('\n') + '\n'
}

function facts(business: BusinessSummary): string[] {
  const rows: [string, string | number | null][] = [
    ['Category', business.primaryCategory],
    ['Address', business.address],
    ['Phone', business.phone],
    ['Website', business.website],
    ['Rating', business.rating],
    ['Reviews', business.reviewCount],
    ['Place ID', business.placeId],
    ['CID', business.cid],
  ]
  return [
    ...rows.map(([label, entry]) => `- ${label}: ${entry === null ? 'unknown' : entry}`),
    `- Read from ${business.source} at ${business.readAt}`,
  ]
}

function evidenceText(evidence: Evidence): string {
  return [
    evidence.url,
    evidence.value === undefined ? undefined : `"${evidence.value}"`,
    evidence.note,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(', ')
}
