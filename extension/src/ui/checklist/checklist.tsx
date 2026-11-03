import type { LocalFinding } from '@local-seo/core/audit'
import { LOCAL_GROUP_LABEL, localCheck } from '@local-seo/core/registry'
import { Badge, SeverityBadge, StatusMark } from '../components/badge'
import { statusTone } from '../components/tone'
import { CopyButton } from '../copy-button'
import { groupFindings, type FindingGroup } from './groups'
import styles from './checklist.module.css'

const toFix = (finding: LocalFinding) => finding.status === 'fail' || finding.status === 'partial'

/**
 * One bordered section per check group, Agent Ready's checklist for L1 to L39. Sections with
 * something to fix start open; a row shows what was found until it is opened for the why and
 * the fix.
 */
export function Checklist({
  findings,
  expanded = false,
}: {
  readonly findings: readonly LocalFinding[]
  /** Opens every section and fold, for a view of one group's few checks. */
  readonly expanded?: boolean
}) {
  return (
    <div className={styles.groups}>
      {groupFindings(findings).map((group) => (
        <Group key={group.group} group={group} expanded={expanded} />
      ))}
    </div>
  )
}

function Group({ group, expanded }: { readonly group: FindingGroup; readonly expanded: boolean }) {
  const open = group.findings.filter(toFix)
  const rest = group.findings.filter((finding) => !toFix(finding))
  return (
    <details className={styles.group} open={expanded || open.length > 0}>
      <summary className={styles.groupHead}>
        <Chevron />
        <span className={styles.groupTitle}>{LOCAL_GROUP_LABEL[group.group]}</span>
        <Tally findings={group.findings} />
      </summary>
      {open.length === 0 ? (
        <Rows findings={rest} />
      ) : (
        <>
          <Rows findings={open} />
          {rest.length === 0 ? null : (
            <details className={styles.fold} open={expanded}>
              <summary>
                <Chevron />
                {restLabel(rest)}
              </summary>
              <Rows findings={rest} />
            </details>
          )}
        </>
      )}
    </details>
  )
}

/** "2 to fix" in the worst finding's tone, else how many passed, else untested. */
function Tally({ findings }: { readonly findings: readonly LocalFinding[] }) {
  const open = findings.filter(toFix)
  const passed = findings.filter((finding) => finding.status === 'pass').length
  const worst = open.at(0)
  if (worst !== undefined) {
    return (
      <span className={styles.tally}>
        <Badge tone={statusTone(worst.status, worst.severity)}>{open.length} to fix</Badge>
      </span>
    )
  }
  if (passed === 0) return <span className={`${styles.tally} ${styles.muted}`}>Untested</span>
  return (
    <span className={`${styles.tally} ${styles.passed}`}>
      <StatusMark status="pass" severity={null} />
      {passed < findings.length ? `${passed} pass` : passed === 1 ? 'Passes' : `All ${passed} pass`}
    </span>
  )
}

function restLabel(rest: readonly LocalFinding[]): string {
  const passed = rest.filter((finding) => finding.status === 'pass').length
  const unjudged = rest.length - passed
  return [passed > 0 ? `${passed} passed` : null, unjudged > 0 ? `${unjudged} untested` : null]
    .filter((part) => part !== null)
    .join(', ')
}

function Rows({ findings }: { readonly findings: readonly LocalFinding[] }) {
  return (
    <ul className={styles.rows}>
      {findings.map((finding) => (
        <Row key={finding.checkId} finding={finding} />
      ))}
    </ul>
  )
}

function Row({ finding }: { readonly finding: LocalFinding }) {
  const check = localCheck(finding.checkId)
  const actionable = toFix(finding)
  return (
    <li>
      <details className={styles.row}>
        <summary className={styles.rowHead}>
          <StatusMark status={finding.status} severity={finding.severity} />
          <span className={actionable ? styles.title : `${styles.title} ${styles.quiet}`}>
            {finding.summary}
          </span>
          {finding.severity === null ? null : <SeverityBadge severity={finding.severity} />}
        </summary>
        <div className={styles.rowBody}>
          <p className={styles.summary}>
            {check.title} <span className={styles.muted}>({check.id})</span>
          </p>
          <p className={styles.rubric}>{check.rubric}</p>
          {finding.evidence.length === 0 ? null : (
            <ul className={styles.evidence}>
              {finding.evidence.map((evidence, at) => (
                <li key={at}>
                  {[evidence.value, evidence.url, evidence.note].filter(Boolean).join(' · ')}
                </li>
              ))}
            </ul>
          )}
          {actionable ? (
            <>
              <p className={styles.fix}>{check.fix}</p>
              <div className={styles.actions}>
                <CopyButton text={`${check.title} (${check.id}): ${check.fix}`} label="Copy fix" />
              </div>
            </>
          ) : null}
        </div>
      </details>
    </li>
  )
}

function Chevron() {
  return (
    <svg className={styles.chevron} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="m4.5 2.5 3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
