import type { LocalGroup } from '@local-seo/core/registry'
import { LOCAL_GROUP_LABEL } from '@local-seo/core/registry'
import { useState } from 'react'
import type { BusinessView } from '../../shared/local'
import { Checklist } from '../checklist/checklist'
import { countsLine } from '../checklist/groups'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { TextField } from '../components/field'
import { Empty, ErrorNote, Note } from '../components/notice'
import { ExportBar, fileName } from '../export-bar'
import { Segmented } from '../parts'
import styles from '../screens/screens.module.css'
import type { Task } from '../use-task'
import { BusinessCard } from './business-card'
import { DraftBox } from './draft-box'
import { SearchPageNotice } from '../search-notice'
import { HistoryCard } from './history-card'

type Writer = 'description' | 'post' | 'services'

/** The open business: who it is, every check with its fix, what changed, and drafts to paste. */
export function BusinessScreen({
  onMapsPlace,
  searchPage,
  audit,
  group,
  onGroup,
  onAudit,
}: {
  /** True when the tab in front shows a place in Google Maps. */
  readonly onMapsPlace: boolean
  /** On a Google results page, its search (null when it has none); undefined elsewhere. */
  readonly searchPage: string | null | undefined
  readonly audit: Task<BusinessView>
  /** The check group the score strip narrowed the checklist to; null shows every check. */
  readonly group: LocalGroup | null
  readonly onGroup: (group: LocalGroup | null) => void
  readonly onAudit: (keyword: string | null) => void
}) {
  const [keyword, setKeyword] = useState('')
  const view = audit.kind === 'done' ? audit.value : audit.kind === 'idle' ? null : audit.previous
  const running = audit.kind === 'running'
  const start = () => onAudit(keyword.trim() === '' ? null : keyword.trim())
  if (view === null && searchPage !== undefined) return <SearchPageNotice query={searchPage} />
  if (view === null) {
    return (
      <div className={styles.stack}>
        <Empty
          title={onMapsPlace ? 'Audit this business' : 'Open a business in Google Maps'}
          action={
            onMapsPlace ? (
              <Button variant="primary" busy={running} onClick={start}>
                {running ? 'Auditing' : 'Audit this business'}
              </Button>
            ) : null
          }
        >
          Runs all 39 local checks on the profile in front of you, reads its reviews and posts in a
          background tab, and compares it with the businesses ranking for its category. Nothing
          leaves your browser.
        </Empty>
        {onMapsPlace ? (
          <TextField
            label="Search it should rank for (optional)"
            placeholder="emergency dentist"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        ) : null}
        {audit.kind === 'failed' ? <ErrorNote>{audit.error}</ErrorNote> : null}
      </div>
    )
  }
  const findings = group === null ? view.findings : view.findings.filter((f) => f.group === group)
  return (
    <div className={styles.stack}>
      <BusinessCard business={view.business} />
      <Card
        title={group === null ? 'Profile checklist' : `${LOCAL_GROUP_LABEL[group]} checks`}
        subtitle={
          <>
            {countsLine(findings)}
            {view.score.score === null ? null : (
              <>
                {' · '}
                <strong>Score {view.score.score}</strong>
              </>
            )}
          </>
        }
        actions={
          <Button busy={running} disabled={!onMapsPlace} onClick={start}>
            {running ? 'Auditing' : 'Audit again'}
          </Button>
        }
      >
        {group === null ? null : (
          <div className={styles.row}>
            <Badge tone="accent">{LOCAL_GROUP_LABEL[group]}</Badge>
            <Button variant="ghost" onClick={() => onGroup(null)}>
              Show every check
            </Button>
          </div>
        )}
        <Checklist findings={findings} expanded={group !== null} />
        {view.keyword === null ? (
          <Note>
            No search was given, so the keyword checks are untested. Audit again with the search it
            should rank for.
          </Note>
        ) : null}
      </Card>
      {audit.kind === 'failed' ? <ErrorNote>{audit.error}</ErrorNote> : null}
      {view.notes.length === 0 ? null : (
        <Card title="Not read" subtitle="What this audit could not see, and why.">
          <ul className={styles.list}>
            {view.notes.map((note) => (
              <li key={note} className={styles.muted}>
                {note}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <HistoryCard history={view.history} />
      <WritersCard view={view} />
      <Card title="Export" subtitle="Save this audit as a file, or open the full report.">
        <div className={styles.chips}>
          <ExportBar
            files={[
              {
                label: 'Markdown',
                filename: fileName(view.business.name, 'audit', 'md'),
                mime: 'text/markdown',
                text: () => view.reportMarkdown,
              },
              {
                label: 'JSON',
                filename: fileName(view.business.name, 'audit', 'json'),
                mime: 'application/json',
                text: () => JSON.stringify(view, null, 2),
              },
            ]}
          />
          <Button variant="ghost" onClick={() => void openReport()}>
            Full report
          </Button>
        </div>
      </Card>
    </div>
  )
}

function WritersCard({ view }: { readonly view: BusinessView }) {
  const [writer, setWriter] = useState<Writer>('description')
  const [topic, setTopic] = useState('')
  return (
    <Card
      title="AI writers"
      subtitle="Drafts from the facts read above, with your own model key. Copy, then paste."
    >
      <Segmented
        label="What to write"
        value={writer}
        onChange={setWriter}
        options={[
          { id: 'description', label: 'Description' },
          { id: 'post', label: 'Post' },
          { id: 'services', label: 'Services' },
        ]}
      />
      {writer === 'post' ? (
        <TextField
          label="What the post is about (optional)"
          placeholder="New patient offer this month"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        />
      ) : null}
      <DraftBox
        key={writer}
        kind={writer}
        business={view.business}
        topic={topic}
        label={WRITER_LABEL[writer]}
      />
    </Card>
  )
}

const WRITER_LABEL: Readonly<Record<Writer, string>> = {
  description: 'Write a description',
  post: 'Write a post',
  services: 'Suggest services',
}

async function openReport(): Promise<void> {
  // Demo mode carries over, so the report shows the same fixture business.
  const url = browser.runtime.getURL('/report.html') + location.search
  await browser.tabs.create({ url })
}
