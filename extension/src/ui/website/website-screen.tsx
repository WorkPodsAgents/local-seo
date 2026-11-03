import type { WebsiteNapResult } from '@local-seo/core/bridge'
import type { FieldCheck, FieldStatus, WebsiteCheck } from '@local-seo/core/nap'
import type { BusinessView } from '../../shared/local'
import { Checklist } from '../checklist/checklist'
import { call, grantSites } from '../client'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { Empty, ErrorNote } from '../components/notice'
import { Table } from '../components/table'
import type { Tone } from '../components/tone'
import { known, refOf, siteText } from '../parts'
import styles from '../screens/screens.module.css'
import { useTask } from '../use-task'

const STATUS: Readonly<Record<FieldStatus, { tone: Tone; label: string }>> = {
  match: { tone: 'good', label: 'Matches' },
  mismatch: { tone: 'bad', label: 'Differs' },
  not_found: { tone: 'warn', label: 'Not on the page' },
  profile_missing: { tone: 'neutral', label: 'Nothing to compare' },
}

/** Does the business's website say what its Google profile says? */
export function WebsiteScreen({ view }: { readonly view: BusinessView }) {
  const site = known(view.business.website)
  const check = useTask<WebsiteNapResult>()
  const run = () => {
    if (site === null) return
    void check.run(async () => {
      // Asked on the click: Chrome shows the prompt only during the user's gesture.
      await grantSites(site)
      return call('local:check_website_nap', { business: refOf(view.business), url: site })
    })
  }
  const result = check.value
  const website = result?.website ?? view.website
  if (site === null) {
    return (
      <Empty title="No website on the profile">
        The profile links no website, so there is nothing to compare. Add the location page in the
        profile's contact section.
      </Empty>
    )
  }
  const running = check.task.kind === 'running'
  return (
    <div className={styles.stack}>
      <Card
        title="Website against profile"
        subtitle={
          <a className={styles.link} href={site} target="_blank" title={site}>
            {siteText(site)}
          </a>
        }
        actions={
          <Button variant={website === null ? 'primary' : 'secondary'} busy={running} onClick={run}>
            {running ? 'Checking' : website === null ? 'Check website' : 'Check again'}
          </Button>
        }
      >
        {website === null ? (
          <p className={styles.muted}>
            Reads the page the profile links, as a search engine fetches it, and compares its name,
            address, phone and hours. Chrome asks once to allow this site.
          </p>
        ) : (
          <NapTable website={website} />
        )}
        {check.task.kind === 'failed' ? <ErrorNote>{check.task.error}</ErrorNote> : null}
      </Card>
      {website === null ? null : <SignalsCard website={website} />}
      {result === null ? null : (
        <Card title="Website checks" subtitle="L30 to L35 on this page.">
          <Checklist findings={result.findings} expanded />
        </Card>
      )}
    </div>
  )
}

function NapTable({ website }: { readonly website: WebsiteCheck }) {
  const rows: [string, FieldCheck][] = [
    ['Name', website.name],
    ['Address', website.address],
    ['Phone', website.phone],
    ['Hours', website.hours],
  ]
  return (
    <Table<[string, FieldCheck]>
      label="Name, address, phone and hours"
      rows={rows}
      rowKey={([label]) => label}
      columns={[
        { label: 'Field', cell: ([label]) => <strong className={styles.nowrap}>{label}</strong> },
        {
          label: 'Result',
          cell: ([, field]) => (
            <Badge tone={STATUS[field.status].tone}>{STATUS[field.status].label}</Badge>
          ),
        },
        {
          label: 'Site states',
          cell: ([, field]) =>
            field.found.length === 0 ? (
              <span className={styles.muted}>{nothingFound(field)}</span>
            ) : (
              field.found.slice(0, 2).join('; ')
            ),
        },
      ]}
    />
  )
}

function nothingFound(field: FieldCheck): string {
  return field.profile === null ? '–' : 'Nothing found'
}

function SignalsCard({ website }: { readonly website: WebsiteCheck }) {
  const schema = website.localSchema
  return (
    <Card title="Local signals on the page">
      <ul className={styles.list}>
        <li className={styles.spread}>
          <span>LocalBusiness schema</span>
          {schema === null ? (
            <Badge tone="bad">None</Badge>
          ) : (
            <Badge tone={schema.missing.length === 0 ? 'good' : 'warn'}>
              {schema.types.join(', ')}
            </Badge>
          )}
        </li>
        {schema === null || schema.missing.length === 0 ? null : (
          <li className={styles.muted}>Schema lacks: {schema.missing.join(', ')}</li>
        )}
        <li className={styles.spread}>
          <span>Click-to-call link</span>
          <Badge tone={website.telLinks.length > 0 ? 'good' : 'bad'}>
            {website.telLinks.length > 0 ? website.telLinks[0] : 'None'}
          </Badge>
        </li>
        <li className={styles.spread}>
          <span>Embedded Google map</span>
          <Badge tone={website.embeddedMap ? 'good' : 'neutral'}>
            {website.embeddedMap ? 'Yes' : 'No'}
          </Badge>
        </li>
      </ul>
    </Card>
  )
}
