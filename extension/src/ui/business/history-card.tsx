import type { ProfileChange, ProfileField } from '@local-seo/core/bridge'
import { isMissing, type Known } from '@local-seo/core/business'
import { Card } from '../components/card'
import { Table } from '../components/table'
import type { SavedRead } from '../../services/snapshots'
import styles from '../screens/screens.module.css'

const FIELD_LABEL: Readonly<Record<ProfileField, string>> = {
  name: 'Name',
  primaryCategory: 'Primary category',
  secondaryCategories: 'Other categories',
  address: 'Address',
  phone: 'Phone',
  website: 'Website',
  hours: 'Hours',
  description: 'Description',
  rating: 'Rating',
  reviewCount: 'Reviews',
  photoCount: 'Photos',
  claimed: 'Claimed',
  closure: 'Open or closed',
}

/** What changed since the last time this browser read the profile, kept only on this device. */
export function HistoryCard({ history }: { readonly history: SavedRead }) {
  if (history.previous === null) {
    return (
      <Card
        title="Changes since your last visit"
        subtitle="First visit. A snapshot is saved on this device to compare with next time."
      />
    )
  }
  const since = new Date(history.previous.readAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return (
    <Card
      title="Changes since your last visit"
      subtitle={
        history.changes.length === 0
          ? `Nothing changed since ${since}.`
          : `${history.changes.length} changed since ${since}.`
      }
      flush={history.changes.length > 0}
    >
      {history.changes.length === 0 ? null : (
        <Table<ProfileChange>
          label="Profile changes"
          rows={history.changes}
          rowKey={(change) => change.field}
          columns={[
            { label: 'Field', cell: (change) => FIELD_LABEL[change.field] },
            { label: 'Was', cell: (change) => <Value value={change.from} /> },
            { label: 'Now', cell: (change) => <Value value={change.to} /> },
          ]}
        />
      )}
    </Card>
  )
}

function Value({ value }: { readonly value: Known<string> }) {
  if (!isMissing(value)) return <>{value}</>
  return <span className={styles.muted}>{value.absent === true ? 'None listed' : 'Not seen'}</span>
}
