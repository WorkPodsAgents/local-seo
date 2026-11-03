// AX1, key tasks an AI agent cannot complete, judged from agent journeys the way the WorkPods axo
// reference judges its browser tasks: a partial or blocked task fires the check, and a task our own
// safety rules stopped (a submit, a sign-in, the step cap) never does, since the agent got as far
// as a person's confirmation.
import type { Finding } from '../model'
import { count, finding } from './finding'

export type TaskOutcome =
  'completed_read_only' | 'reached_confirmation' | 'partial' | 'blocked' | 'stopped_by_policy'

export interface TaskAttempt {
  readonly task: string
  readonly outcome: TaskOutcome
  /** Where and why it stopped; null when it completed. */
  readonly stoppedAt: string | null
}

const FAILED: ReadonlySet<TaskOutcome> = new Set(['partial', 'blocked'])

/** One verdict over the latest attempt at each task. */
export function agentTasksFinding(attempts: readonly TaskAttempt[]): Finding {
  const verdict = (status: 'pass' | 'fail' | 'not_applicable', summary: string, cited = attempts) =>
    finding(
      'AX1',
      'axo',
      'ai_readiness',
      status,
      summary,
      cited.map((attempt) => ({
        value: attempt.task,
        note: `${attempt.outcome.replaceAll('_', ' ')}${
          attempt.stoppedAt === null ? '' : `: ${attempt.stoppedAt}`
        }`,
      })),
    )
  if (attempts.length === 0) {
    return verdict('not_applicable', 'No agent journey has run on this site. Run one in Journeys.')
  }
  const failed = attempts.filter((attempt) => FAILED.has(attempt.outcome))
  if (failed.length === 0) {
    return verdict('pass', `An agent got through ${count(attempts.length, 'key task')}.`)
  }
  const summary =
    failed.length === attempts.length
      ? `An agent could not finish any of ${count(attempts.length, 'key task')}.`
      : `An agent could not finish ${failed.length} of ${count(attempts.length, 'key task')}.`
  const result = verdict('fail', summary, failed)
  // The rubric's critical case: blocked on every key task. Otherwise the registry default.
  const everyBlocked = attempts.every((attempt) => attempt.outcome === 'blocked')
  return everyBlocked ? { ...result, severity: 'critical' } : result
}
