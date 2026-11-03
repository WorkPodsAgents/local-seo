// "Copy fix for your coding agent": one finding as a prompt Claude Code or Codex can act on in
// the user's codebase, ending with the command that proves the fix worked.
import type { Finding } from '../model'
import { check } from '../registry'
import { rubricLine } from './order'
import { whereText } from './markdown'

export interface FixContext {
  /** The page the check ran on, or the start URL of the crawl that found it. */
  readonly url: string
  /** Which command re-runs the check: a page check, or a crawl for cross-page checks. */
  readonly from: 'check' | 'crawl'
}

const CLI = 'npx -y @workpods/agent-ready'

export function fixPrompt(finding: Finding, context: FixContext): string {
  const entry = check(finding.checkId)
  const severity = finding.severity === null ? '' : `, severity ${finding.severity}`
  const lines = [
    `Fix a problem that stops search engines, AI answers or AI agents from using ${context.url}.`,
    '',
    `Problem: ${entry.title} (check \`${finding.checkId}\`${severity}).`,
    `What was found: ${finding.summary}`,
  ]
  if (finding.evidence.length > 0) {
    lines.push('Where:', ...finding.evidence.map((evidence) => `- ${whereText(evidence)}`))
  }
  const rubric = rubricLine(finding)
  if (rubric !== null) lines.push(`Why it matters at this severity: ${rubric}`)
  lines.push(
    '',
    'Find the template, component or config that produces this and change it at the source, so ' +
      'every page built from it is fixed. Change only what this fix needs and keep wording that ' +
      'already works.',
    `Done when \`${CLI} ${context.from} ${context.url}\` no longer reports ` +
      `\`${finding.checkId}\` as failing. Deploy or run the site locally before you rerun it.`,
  )
  return lines.join('\n') + '\n'
}
