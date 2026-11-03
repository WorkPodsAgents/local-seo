// Share of voice across many scored answers: how often each party shows up, overall and per
// engine. A party shows up in an answer when it is named or cited.
import type { AnswerEngine } from './answer'
import type { PartyScore, ScoredAnswer } from './score'

export interface PartyShare {
  readonly name: string
  readonly role: PartyScore['role']
  /** Answers that named or cited it. */
  readonly visible: number
  readonly cited: number
  /** visible / answers; null when there are no answers. */
  readonly visibleRate: number | null
  /** Its part of all parties' appearances, 0 to 1; null when no party appeared. */
  readonly share: number | null
}

export interface VoiceBreakdown {
  readonly answers: number
  readonly parties: readonly PartyShare[]
}

export interface ShareOfVoice extends VoiceBreakdown {
  readonly byEngine: Readonly<Partial<Record<AnswerEngine, VoiceBreakdown>>>
}

export function shareOfVoice(scored: readonly ScoredAnswer[]): ShareOfVoice {
  const engines = [...new Set(scored.map((answer) => answer.engine))]
  const byEngine: Partial<Record<AnswerEngine, VoiceBreakdown>> = {}
  for (const engine of engines) {
    byEngine[engine] = breakdown(scored.filter((answer) => answer.engine === engine))
  }
  return { ...breakdown(scored), byEngine }
}

function breakdown(scored: readonly ScoredAnswer[]): VoiceBreakdown {
  const tally = new Map<string, { role: PartyScore['role']; visible: number; cited: number }>()
  for (const answer of scored) {
    for (const party of answer.parties) {
      const entry = tally.get(party.name) ?? { role: party.role, visible: 0, cited: 0 }
      if (party.status !== 'absent') entry.visible += 1
      if (party.cited) entry.cited += 1
      tally.set(party.name, entry)
    }
  }
  const appearances = [...tally.values()].reduce((sum, entry) => sum + entry.visible, 0)
  const parties = [...tally].map(([name, { role, visible, cited }]) => ({
    name,
    role,
    visible,
    cited,
    visibleRate: scored.length === 0 ? null : visible / scored.length,
    share: appearances === 0 ? null : visible / appearances,
  }))
  return { answers: scored.length, parties }
}
