import type { Fix } from '@local-seo/core/report'
import { useEffect, useState } from 'react'
import { LogoMark } from '../../../vendor/agent-ready/vendor/workpods/logo/logo-mark'
import type { BusinessView } from '../../src/shared/local'
import { BusinessCard } from '../../src/ui/business/business-card'
import { HistoryCard } from '../../src/ui/business/history-card'
import { Checklist } from '../../src/ui/checklist/checklist'
import { countsLine } from '../../src/ui/checklist/groups'
import { call, errorText } from '../../src/ui/client'
import { SeverityBadge } from '../../src/ui/components/badge'
import { Card } from '../../src/ui/components/card'
import { Empty, ErrorNote } from '../../src/ui/components/notice'
import { Table } from '../../src/ui/components/table'
import { ExportBar, fileName } from '../../src/ui/export-bar'
import { ScanTable } from '../../src/ui/scan/scan-screen'
import { groupScores, GROUP_SHORT } from '../../src/ui/score-strip'
import styles from './report.module.css'

/** The last profile audit at full width, with every check, fix and competitor. */
export function Report() {
  const [view, setView] = useState<BusinessView | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    call('business:last', {}).then(setView, (failure: unknown) => setError(errorText(failure)))
  }, [])
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <LogoMark size={28} />
        <div className={styles.titles}>
          <h1 className={styles.title}>Profile report</h1>
          <span className={styles.meta}>
            {view ? `${view.business.name} · read ${readDate(view.business.readAt)}` : 'Local SEO'}
          </span>
        </div>
        {view?.score.score == null ? null : (
          <div className={styles.score} aria-label={`Score ${view.score.score} of 100`}>
            <span className={styles.scoreValue}>{view.score.score}</span>
            <span className={styles.meta}>
              of 100 · {view.score.judged} checks judged, {view.score.untested} untested
            </span>
          </div>
        )}
      </header>
      {view ? <Groups view={view} /> : null}
      <main className={styles.body}>
        {error === null ? null : <ErrorNote>{error}</ErrorNote>}
        {view === null ? (
          <Empty title="No audit yet">Audit a business from the side panel first.</Empty>
        ) : null}
        {view ? <Body view={view} /> : null}
      </main>
    </div>
  )
}

function Groups({ view }: { readonly view: BusinessView }) {
  return (
    <ul className={styles.groups} aria-label="Checks passed per group">
      {groupScores(view.findings).map((score) => {
        const total = score.passed + score.failing + score.untested
        return (
          <li key={score.group} className={styles.group}>
            <span className={styles.groupName}>{GROUP_SHORT[score.group]}</span>
            <span className={styles.groupValue}>
              {score.passed} of {total}
            </span>
            <span className={styles.groupNote}>
              {score.failing > 0 ? `${score.failing} to fix` : 'Nothing to fix'}
              {score.untested > 0 ? ` · ${score.untested} untested` : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Body({ view }: { readonly view: BusinessView }) {
  return (
    <>
      <div className={styles.columns}>
        <BusinessCard business={view.business} />
        <Card title="Fixes, most important first" subtitle={`${view.fixes.length} to make`} flush>
          <Table<Fix>
            label="Fixes"
            rows={view.fixes}
            rowKey={(fix) => fix.checkId}
            columns={[
              {
                label: 'Fix',
                cell: (fix) => (
                  <>
                    <strong>{fix.title}</strong>
                    <br />
                    <span className={styles.fixText}>{fix.fix}</span>
                  </>
                ),
              },
              { label: 'Severity', cell: (fix) => <SeverityBadge severity={fix.severity} /> },
            ]}
          />
        </Card>
      </div>
      <Card
        title="Every check"
        subtitle={countsLine(view.findings)}
        actions={
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
        }
      >
        <Checklist findings={view.findings} />
      </Card>
      {view.competitors === null ? null : (
        <Card title={`Who ranks for “${view.keyword ?? 'its category'}”`} flush>
          <ScanTable rows={view.competitors} ownName={view.business.name} />
        </Card>
      )}
      <HistoryCard history={view.history} />
      {view.notes.length === 0 ? null : (
        <Card title="Not read">
          <ul className={styles.notes}>
            {view.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function readDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
