// The WorkPods check registry (vendor/workpods/contracts), so a check here carries the same id,
// severity and rubric wording as the same check in a WorkPods audit.
import registry from '../../../vendor/workpods/contracts/check-registry.json' with { type: 'json' }
import thresholdFile from '../../../vendor/workpods/contracts/thresholds.json' with { type: 'json' }

export type Theme = 'lifecycle' | 'technical' | 'content' | 'seo' | 'geo'
export type Severity = 'critical' | 'high' | 'medium' | 'low'
/** Who judges the check in a WorkPods audit: the server, from fetched pages, or the agent. */
export type Owner = 'server' | 'agent'
/** What a server check needs: a plain fetch, or the page as a browser renders it. */
export type Basis = 'http' | 'rendered'

export interface Check {
  readonly id: string
  readonly title: string
  readonly theme: Theme
  readonly defaultSeverity: Severity
  readonly owner: Owner
  readonly basis: Basis | null
  /** What the finding means at each severity. */
  readonly rubric: Readonly<Record<Severity, string>>
}

export const CHECKS: ReadonlyMap<string, Check> = new Map(
  registry.checks.map((entry) => [
    entry.id,
    {
      id: entry.id,
      title: entry.title,
      theme: entry.theme as Theme,
      defaultSeverity: entry.default_severity as Severity,
      owner: entry.owner as Owner,
      basis: entry.basis as Basis | null,
      rubric: entry.rubric,
    },
  ]),
)

export function check(id: string): Check {
  const found = CHECKS.get(id)
  if (found === undefined) throw new Error(`unknown check id: ${id}`)
  return found
}

const THRESHOLDS: ReadonlyMap<string, number> = new Map(
  thresholdFile.thresholds.map((entry) => [entry.id, entry.default]),
)

export function threshold(id: string): number {
  const found = THRESHOLDS.get(id)
  if (found === undefined) throw new Error(`unknown threshold id: ${id}`)
  return found
}
