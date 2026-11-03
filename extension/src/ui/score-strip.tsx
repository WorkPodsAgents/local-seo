import type { LocalFinding } from '@local-seo/core/audit'
import type { LocalGroup } from '@local-seo/core/registry'
import { LOCAL_GROUPS } from '@local-seo/core/registry'
import styles from './score-strip.module.css'

/** Short names for the strip's cells; the checklist uses the registry's full labels. */
export const GROUP_SHORT: Readonly<Record<LocalGroup, string>> = {
  profile_basics: 'Profile',
  categories: 'Categories',
  content: 'Content',
  photos: 'Photos',
  reviews: 'Reviews',
  posts: 'Posts',
  website: 'Website',
  trust: 'Trust',
}

interface GroupScore {
  readonly group: LocalGroup
  readonly passed: number
  readonly failing: number
  readonly untested: number
}

/** A partial counts as failing; a check whose input was not read is untested, never a fail. */
export function groupScores(findings: readonly LocalFinding[]): GroupScore[] {
  return LOCAL_GROUPS.map((group) => {
    const inGroup = findings.filter((finding) => finding.group === group)
    const untested = inGroup.filter((finding) => finding.status === 'not_applicable').length
    const passed = inGroup.filter((finding) => finding.status === 'pass').length
    return { group, passed, failing: inGroup.length - passed - untested, untested }
  })
}

/**
 * The profile's eight check groups on the aubergine band: passed over every check in the group,
 * and a bar of passed, failing and untested. Each cell opens that group's checks.
 */
export function ScoreStrip({
  findings,
  selected,
  onSelect,
}: {
  readonly findings: readonly LocalFinding[] | null
  readonly selected: LocalGroup | null
  readonly onSelect: (group: LocalGroup) => void
}) {
  const scores = groupScores(findings ?? [])
  return (
    <ul className={styles.strip} aria-label="Checks passed per group">
      {scores.map((score) => {
        const total = score.passed + score.failing + score.untested
        const share = (n: number) => (total === 0 ? 0 : (n / total) * 100)
        const name = GROUP_SHORT[score.group]
        const label =
          `${name}: ${score.passed} passed, ${score.failing} failing, ` +
          `${score.untested} untested. Show these checks.`
        const judged = findings !== null && total > 0
        return (
          <li key={score.group}>
            <button
              type="button"
              className={styles.cell}
              disabled={!judged}
              aria-pressed={selected === score.group}
              aria-label={judged ? label : `${name}: not checked yet`}
              title={judged ? label : undefined}
              onClick={() => onSelect(score.group)}
            >
              <span className={styles.group}>{name}</span>
              <span className={judged ? styles.value : `${styles.value} ${styles.muted}`}>
                {judged ? `${score.passed} of ${total}` : 'Not checked'}
              </span>
              <span className={styles.bar} aria-hidden="true">
                <span className={styles.fill} style={{ width: `${share(score.passed)}%` }} />
                <span className={styles.missed} style={{ width: `${share(score.failing)}%` }} />
                <span className={styles.open} style={{ width: `${share(score.untested)}%` }} />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
