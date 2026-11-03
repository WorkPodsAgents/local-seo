import type { Business, Review } from '@local-seo/core/business'
import { DRAFT_LIMIT, type DraftKind } from '@local-seo/core/writers'
import { useState } from 'react'
import { call } from '../client'
import { Button } from '../components/button'
import { ErrorNote, Note } from '../components/notice'
import { CopyButton } from '../copy-button'
import { useStatus } from '../status-context'
import styles from '../screens/screens.module.css'
import { useTask } from '../use-task'
import type { Draft } from '../../shared/local'

const MODEL_KEYS = ['anthropic_key', 'openai_key', 'gemini_key'] as const

/**
 * Writes one draft with the user's own model key and shows it to copy. Nothing is published:
 * the owner pastes the draft into their Google profile themselves.
 */
export function DraftBox({
  kind,
  business,
  review,
  topic,
  label,
}: {
  readonly kind: DraftKind
  readonly business: Business
  readonly review?: Review
  readonly topic?: string
  readonly label: string
}) {
  const { status } = useStatus()
  const draft = useTask<Draft>()
  const [text, setText] = useState<string | null>(null)
  const hasModel = status !== null && MODEL_KEYS.some((key) => status.stored.includes(key))
  const write = () =>
    void draft.run(async () => {
      const result = await call('draft:write', {
        kind,
        business,
        ...(review === undefined ? {} : { review }),
        ...(topic === undefined || topic.trim() === '' ? {} : { topic }),
      })
      setText(result.text)
      return result
    })
  const limit = kind === 'services' ? null : DRAFT_LIMIT[kind]
  const shown = text ?? draft.value?.text ?? null
  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <Button
          variant="primary"
          busy={draft.task.kind === 'running'}
          disabled={!hasModel}
          onClick={write}
        >
          {draft.task.kind === 'running' ? 'Writing' : shown === null ? label : 'Write again'}
        </Button>
        {hasModel ? null : (
          <span className={styles.muted}>Add an Anthropic, OpenAI or Gemini key in Settings.</span>
        )}
      </div>
      {shown === null ? null : (
        <>
          <textarea
            className={styles.draft}
            value={shown}
            aria-label={`${label}: draft`}
            onChange={(event) => setText(event.target.value)}
          />
          <div className={styles.spread}>
            <span className={styles.muted}>
              {limit === null
                ? `${shown.split('\n').filter((line) => line.trim() !== '').length} services`
                : `${shown.length} of ${limit} characters`}
              {draft.value === null ? '' : ` · ${draft.value.model}`}
            </span>
            <CopyButton text={shown} />
          </div>
          <Note>A draft only. Read it, then paste it into your Google Business Profile.</Note>
        </>
      )}
      {draft.task.kind === 'failed' ? <ErrorNote>{draft.task.error}</ErrorNote> : null}
    </div>
  )
}
