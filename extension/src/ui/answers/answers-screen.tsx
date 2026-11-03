import {
  ALL_AI_ENGINES,
  type AiEngine,
  type EngineAnswer,
  type LocalAiVisibilityResult,
} from '@local-seo/core/bridge'
import { isMissing } from '@local-seo/core/business'
import { useState } from 'react'
import { ENGINE_HOME, ENGINE_LABEL } from '../../answers/engines'
import { CLORO_ENGINES } from '../../answers/visibility'
import type { PaidRequest } from '../../shared/api'
import { call, grantOrigins } from '../client'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { Checkbox, FieldRow, TextField } from '../components/field'
import { ErrorNote, Note } from '../components/notice'
import { PaidAction } from '../components/paid-action'
import { Segmented } from '../parts'
import styles from '../screens/screens.module.css'
import { useTask } from '../use-task'

type Mode = 'assist' | 'cloro'

/** Whether AI assistants recommend the business when a local buyer asks them. */
export function AnswersCard({
  businessName,
  defaultQuery,
  defaultCity,
  defaultCompetitors,
}: {
  readonly businessName: string
  readonly defaultQuery: string
  readonly defaultCity: string
  readonly defaultCompetitors: readonly string[]
}) {
  const [query, setQuery] = useState(defaultQuery)
  const [city, setCity] = useState(defaultCity)
  const [name, setName] = useState(businessName)
  const [rivals, setRivals] = useState(defaultCompetitors.join(', '))
  const [engines, setEngines] = useState<readonly AiEngine[]>(ALL_AI_ENGINES)
  const [mode, setMode] = useState<Mode>('assist')
  const answers = useTask<LocalAiVisibilityResult>()
  const chosen = mode === 'cloro' ? engines.filter((e) => CLORO_ENGINES.includes(e)) : engines
  const args = {
    query,
    city,
    businessName: name,
    competitors: rivals
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== ''),
    engines: [...chosen],
  }
  const valid = query.trim() !== '' && city.trim() !== '' && name.trim() !== '' && chosen.length > 0
  const running = answers.task.kind === 'running'
  const run = () =>
    void answers.run(async () => {
      if (mode === 'cloro') return (await call('paid:ai_answers', args)).data
      // Asked on the click: Chrome shows the prompt only during the user's gesture.
      const allowed = await grantOrigins(
        chosen.map((engine) => `${new URL(ENGINE_HOME[engine]).origin}/*`),
      )
      if (!allowed) throw new Error('Allow the assistants so their answers can be read.')
      return call('answers:assist', args)
    })
  const request: PaidRequest | null = valid ? { op: 'paid:ai_answers', args } : null
  return (
    <Card
      title="AI answers"
      subtitle="Ask ChatGPT, Gemini, Perplexity and Google AI Mode the question a local buyer asks."
    >
      <FieldRow>
        <TextField label="Service" value={query} onChange={(e) => setQuery(e.target.value)} />
        <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
      </FieldRow>
      <TextField label="Business" value={name} onChange={(e) => setName(e.target.value)} />
      <TextField
        label="Competitors to look for"
        hint="Comma separated"
        value={rivals}
        onChange={(e) => setRivals(e.target.value)}
      />
      <div className={styles.chips} role="group" aria-label="Assistants">
        {ALL_AI_ENGINES.map((engine) => (
          <Checkbox
            key={engine}
            label={ENGINE_LABEL[engine]}
            checked={engines.includes(engine)}
            onChange={(on) =>
              setEngines((current) =>
                on ? [...current, engine] : current.filter((entry) => entry !== engine),
              )
            }
          />
        ))}
      </div>
      <Segmented
        label="How to ask"
        value={mode}
        onChange={setMode}
        options={[
          { id: 'assist', label: 'Assist, free' },
          { id: 'cloro', label: 'Cloro, unattended' },
        ]}
      />
      {mode === 'assist' ? (
        <>
          <Note>
            Each assistant opens in a tab of your own browser with the question filled in. You read
            it and press Enter; Local SEO never sends a prompt for you.
          </Note>
          <div className={styles.row}>
            <Button variant="primary" busy={running} disabled={!valid} onClick={run}>
              {running ? 'Waiting for your answers' : 'Open the assistants'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Note>Cloro asks ChatGPT, Gemini and AI Mode with your key. It has no Perplexity.</Note>
          <PaidAction request={request} label="Ask through Cloro" busy={running} onRun={run} />
        </>
      )}
      {answers.task.kind === 'failed' ? <ErrorNote>{answers.task.error}</ErrorNote> : null}
      {answers.value === null ? null : <AnswerList result={answers.value} />}
    </Card>
  )
}

function AnswerList({ result }: { readonly result: LocalAiVisibilityResult }) {
  return (
    <div>
      <p className={styles.muted}>“{result.prompt}”</p>
      {result.answers.map((entry) => (
        <AnswerRow key={entry.engine} entry={entry} />
      ))}
      <Note>One run is one sample: assistants answer differently from one day to the next.</Note>
    </div>
  )
}

function AnswerRow({ entry }: { readonly entry: EngineAnswer }) {
  const answer = entry.answer
  if (isMissing(answer)) {
    return (
      <div className={styles.verdict}>
        <div className={styles.spread}>
          <span className={styles.sectionTitle}>{ENGINE_LABEL[entry.engine]}</span>
          <Badge tone="neutral">Not read</Badge>
        </div>
        <p className={styles.muted}>{answer.reason}</p>
      </div>
    )
  }
  const tone =
    answer.verdict === 'recommended' ? 'good' : answer.verdict === 'named' ? 'warn' : 'bad'
  const label =
    answer.verdict === 'absent'
      ? 'Not named'
      : `${answer.verdict === 'recommended' ? 'Recommended' : 'Named'} #${answer.position}`
  return (
    <div className={styles.verdict}>
      <div className={styles.spread}>
        <span className={styles.sectionTitle}>{ENGINE_LABEL[entry.engine]}</span>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <p className={styles.quote}>{plainText(answer.excerpt)}</p>
      <span className={styles.muted}>
        {answer.businessesNamed.length} businesses named
        {answer.competitorsNamed.length === 0
          ? ''
          : ` · competitors: ${answer.competitorsNamed.join(', ')}`}
        {answer.citedUrls.length === 0 ? '' : ` · ${answer.citedUrls.length} sources cited`}
      </span>
    </div>
  )
}

/** The excerpt as a reader sees it in the assistant: markdown emphasis and list numbers gone. */
function plainText(markdown: string): string {
  return markdown
    .replace(/\*\*|__/g, '')
    .replace(/^\s*(?:\d+[.)]|[-*•])\s+/gm, '')
    .replace(/\s*\n\s*/g, ' · ')
}
