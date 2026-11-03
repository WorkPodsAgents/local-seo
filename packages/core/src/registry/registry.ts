// Local SEO's own check registry. Ids, wording and thresholds live in local-checks.json so a
// threshold can change without touching the check that reads it.
import file from './local-checks.json' with { type: 'json' }

export type LocalSeverity = 'high' | 'medium' | 'low'

/** The profile audit's groups, in the order the panel and the report show them. */
export type LocalGroup =
  'profile_basics' | 'categories' | 'content' | 'photos' | 'reviews' | 'posts' | 'website' | 'trust'

export const LOCAL_GROUPS: readonly LocalGroup[] = [
  'profile_basics',
  'categories',
  'content',
  'photos',
  'reviews',
  'posts',
  'website',
  'trust',
]

export const LOCAL_GROUP_LABEL: Readonly<Record<LocalGroup, string>> = {
  profile_basics: 'Profile basics',
  categories: 'Categories',
  content: 'Description, services and attributes',
  photos: 'Photos',
  reviews: 'Reviews',
  posts: 'Posts',
  website: 'Website',
  trust: 'Trust and risk',
}

export interface LocalCheck {
  readonly id: string
  readonly title: string
  readonly layer: 'local'
  readonly group: LocalGroup
  readonly severity: LocalSeverity
  /** Why the check matters, in a searcher's or Google's terms. */
  readonly rubric: string
  /** What the owner does to pass it. */
  readonly fix: string
  readonly thresholds: Readonly<Record<string, number>>
}

const SEVERITIES = new Set<string>(['high', 'medium', 'low'])
const GROUPS = new Set<string>(LOCAL_GROUPS)

/** Registry order: the order checks appear in within a group. */
export const LOCAL_CHECKS: ReadonlyMap<string, LocalCheck> = new Map(
  file.checks.map((entry) => [entry.id, validated(entry)]),
)

// A typo in the JSON would otherwise surface as a check silently filed under no group.
function validated(entry: (typeof file.checks)[number]): LocalCheck {
  if (entry.layer !== 'local' || !GROUPS.has(entry.group) || !SEVERITIES.has(entry.severity)) {
    throw new Error(`invalid registry entry: ${entry.id}`)
  }
  const thresholds = 'thresholds' in entry ? (entry.thresholds as Record<string, number>) : {}
  return {
    id: entry.id,
    title: entry.title,
    layer: 'local',
    group: entry.group as LocalGroup,
    severity: entry.severity as LocalSeverity,
    rubric: entry.rubric,
    fix: entry.fix,
    thresholds,
  }
}

export function localCheck(id: string): LocalCheck {
  const found = LOCAL_CHECKS.get(id)
  if (found === undefined) throw new Error(`unknown local check id: ${id}`)
  return found
}

export function localThreshold(id: string, name: string): number {
  const value = localCheck(id).thresholds[name]
  if (value === undefined) throw new Error(`unknown threshold ${name} for local check ${id}`)
  return value
}
