import type { Severity, Status } from '@open-agent-ready/core'

export type Tone = 'good' | 'warn' | 'high' | 'bad' | 'info' | 'neutral' | 'accent'

export const SEVERITY_TONE: Readonly<Record<Severity, Tone>> = {
  critical: 'bad',
  high: 'high',
  medium: 'warn',
  low: 'neutral',
}

/** A failing check takes its severity's tone, as the dashboard's checklist strip does. */
export function statusTone(status: Status, severity: Severity | null): Tone {
  switch (status) {
    case 'pass':
      return 'good'
    case 'partial':
      return 'warn'
    case 'fail':
      return severity === null ? 'bad' : SEVERITY_TONE[severity]
    case 'not_applicable':
      return 'neutral'
  }
}

export const STATUS_LABEL: Readonly<Record<Status, string>> = {
  pass: 'Passed',
  partial: 'Partial',
  fail: 'Failing',
  not_applicable: 'Untested',
}

export const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}
