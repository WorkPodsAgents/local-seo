import type { Business } from '@local-seo/core/business'
import { isMissing } from '@local-seo/core/business'
import { useId } from 'react'
import { Badge } from '../components/badge'
import { Card } from '../components/card'
import { CopyButton } from '../copy-button'
import { known, reasonOf, siteText } from '../parts'
import styles from '../screens/screens.module.css'

/**
 * Who the business is as Google shows it: categories, rating, the ids agents and tools take,
 * and the links an owner hands out. Every value Google did not show says so.
 */
export function BusinessCard({ business }: { readonly business: Business }) {
  const primary = known(business.categories.primary)
  const secondary = known(business.categories.secondary)
  const rating = known(business.rating)
  const reviews = known(business.reviewCount)
  const address = known(business.address)
  const website = known(business.website)
  const { placeId, cid, kgId, featureId } = business.ids
  const ids: [string, string | null][] = [
    ['Place ID', placeId],
    ['CID', cid],
    ['KG ID', kgId],
    ['Feature ID', featureId],
  ]
  return (
    <Card
      title={business.name}
      subtitle={address?.formatted ?? reasonOf(business.address) ?? undefined}
      actions={
        business.closure === null ? null : (
          <Badge tone="bad">
            {business.closure === 'permanent' ? 'Permanently closed' : 'Temporarily closed'}
          </Badge>
        )
      }
    >
      <div className={styles.chips} aria-label="Categories">
        {primary === null ? (
          <span className={styles.chip}>Primary category not shown by Google</span>
        ) : (
          <span className={`${styles.chip} ${styles.chipPrimary}`} title="Primary category">
            {primary}
          </span>
        )}
        {secondary === null ? (
          <span className={styles.chip} title={reasonOf(business.categories.secondary) ?? ''}>
            Other categories not shown
          </span>
        ) : (
          secondary.map((category) => (
            <span key={category} className={styles.chip}>
              {category}
            </span>
          ))
        )}
      </div>
      <div className={styles.row}>
        {rating === null ? (
          <span className={styles.muted}>Rating not shown by Google</span>
        ) : (
          <span className={styles.rankHero}>
            <span className={styles.kpiValue}>{rating.toFixed(1)}</span>
            <Stars rating={rating} />
            <span className={styles.muted}>
              {reviews === null ? 'review count not shown' : `${reviews.toLocaleString()} reviews`}
            </span>
          </span>
        )}
        <ClaimBadge business={business} />
      </div>
      <hr className={styles.divider} />
      <dl className={styles.facts}>
        {ids.map(([label, value]) => (
          <Fact key={label} label={label} value={value} copy />
        ))}
        <Fact label="Phone" value={known(business.phone)} reason={reasonOf(business.phone)} />
        <Fact
          label="Website"
          value={website === null ? null : siteText(website)}
          reason={reasonOf(business.website)}
        />
      </dl>
      <div className={styles.row}>
        {links(business).map((link) => (
          <a key={link.label} className={styles.link} href={link.href} target="_blank">
            {link.label}
          </a>
        ))}
      </div>
    </Card>
  )
}

function Fact({
  label,
  value,
  reason = null,
  copy = false,
}: {
  readonly label: string
  readonly value: string | null
  readonly reason?: string | null
  readonly copy?: boolean
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={copy && value !== null ? styles.mono : undefined}>
        {value ?? <span className={styles.muted}>{reason ?? 'Not shown by Google'}</span>}
      </dd>
      <span>{copy && value !== null ? <CopyButton text={value} what={label} /> : null}</span>
    </>
  )
}

function ClaimBadge({ business }: { readonly business: Business }) {
  if (isMissing(business.claimed)) {
    return (
      <span title={business.claimed.reason}>
        <Badge tone="neutral">Claim status unknown</Badge>
      </span>
    )
  }
  return business.claimed ? <Badge tone="good">Claimed</Badge> : <Badge tone="bad">Unclaimed</Badge>
}

function Stars({ rating }: { readonly rating: number }) {
  const clip = useId()
  const fill = Math.max(0, Math.min(5, rating)) / 5
  return (
    <svg width="70" height="14" viewBox="0 0 70 14" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <rect width={70 * fill} height="14" />
        </clipPath>
      </defs>
      {[0, 1, 2, 3, 4].map((at) => (
        <path key={at} d={star(at * 14 + 7)} fill="var(--surface-strong)" />
      ))}
      <g clipPath={`url(#${CSS.escape(clip)})`}>
        {[0, 1, 2, 3, 4].map((at) => (
          <path key={at} d={star(at * 14 + 7)} fill="var(--status-warning-fg)" />
        ))}
      </g>
    </svg>
  )
}

function star(cx: number): string {
  const points = Array.from({ length: 10 }, (_, at) => {
    const radius = at % 2 === 0 ? 6 : 2.6
    const angle = (Math.PI / 5) * at - Math.PI / 2
    const x = (cx + radius * Math.cos(angle)).toFixed(2)
    const y = (7 + radius * Math.sin(angle)).toFixed(2)
    return `${x},${y}`
  })
  return `M${points.join('L')}Z`
}

/** The links an owner hands out: the Maps profile and the write-a-review link. */
function links(business: Business): { label: string; href: string }[] {
  const { cid, placeId } = business.ids
  const result: { label: string; href: string }[] = []
  if (cid !== null)
    result.push({ label: 'Open in Maps', href: `https://maps.google.com/?cid=${cid}` })
  if (placeId !== null) {
    result.push({
      label: 'Review link',
      href: `https://search.google.com/local/writereview?placeid=${placeId}`,
    })
  }
  return result
}
