// The answer history as CSV, one row per answer and party, for a spreadsheet. A cell that starts
// with = + - @ is prefixed with an apostrophe, so a passage quoted from an answer cannot run as a
// spreadsheet formula when the file is opened.
import type { ScoredAnswer } from './score'

const HEADER = [
  'captured_at',
  'engine',
  'prompt',
  'party',
  'role',
  'status',
  'mention_order',
  'passage',
  'cited_urls',
]

export function historyCsv(scored: readonly ScoredAnswer[]): string {
  const rows = scored.flatMap((answer) =>
    answer.parties.map((party) => [
      answer.capturedAt,
      answer.engine,
      answer.prompt,
      party.name,
      party.role,
      party.status,
      party.mentionOrder === null ? '' : String(party.mentionOrder),
      party.passage ?? '',
      party.citedUrls.join(' '),
    ]),
  )
  return [HEADER, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}

function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
