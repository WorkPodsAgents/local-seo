// What changed in a profile between two reads. A competitor renaming itself, a category swap or
// a suspended listing shows up here. Only facts both reads could see are compared: a read that
// could not tell (Maps' signed-out view hides the description) is not a change.
import type { ProfileChange, ProfileField } from '../bridge'
import type { Business, Known } from '../business'
import { isMissing } from '../business'
import { profileSlots } from '../nap/hours'

export interface Snapshot {
  /** ISO time of the read. */
  readonly readAt: string
  readonly business: Business
}

export const PROFILE_FIELDS: readonly ProfileField[] = [
  'name',
  'primaryCategory',
  'secondaryCategories',
  'address',
  'phone',
  'website',
  'hours',
  'description',
  'rating',
  'reviewCount',
  'photoCount',
  'claimed',
  'closure',
]

/** Each compared field of `business` as text, Missing where the read gave none. */
export function profileValues(business: Business): Readonly<Record<ProfileField, Known<string>>> {
  const text = <T>(value: Known<T>, show: (known: T) => string): Known<string> =>
    isMissing(value) ? value : show(value)
  return {
    name: business.name,
    primaryCategory: business.categories.primary,
    secondaryCategories: text(business.categories.secondary, (list) => [...list].sort().join('; ')),
    address: text(business.address, (address) => address.formatted),
    phone: business.phone,
    website: business.website,
    hours: text(business.hours, (hours) => profileSlots(hours).join('; ')),
    description: business.description,
    rating: text(business.rating, String),
    reviewCount: text(business.reviewCount, String),
    photoCount: text(business.photoCount, String),
    claimed: text(business.claimed, (claimed) => (claimed ? 'claimed' : 'unclaimed')),
    closure: business.closure ?? 'open',
  }
}

/** Changes between consecutive snapshots, oldest first; `snapshots` must be oldest first. */
export function profileChanges(snapshots: readonly Snapshot[]): ProfileChange[] {
  const changes: ProfileChange[] = []
  for (let at = 1; at < snapshots.length; at += 1) {
    const earlier = snapshots[at - 1]
    const later = snapshots[at]
    if (earlier === undefined || later === undefined) continue
    const from = profileValues(earlier.business)
    const to = profileValues(later.business)
    for (const field of PROFILE_FIELDS) {
      if (!changed(from[field], to[field])) continue
      changes.push({
        field,
        before: earlier.readAt,
        after: later.readAt,
        from: from[field],
        to: to[field],
      })
    }
  }
  return changes
}

/** True when the snapshot would add nothing to the one before it. */
export function sameProfile(a: Business, b: Business): boolean {
  const from = profileValues(a)
  const to = profileValues(b)
  return PROFILE_FIELDS.every((field) => !changed(from[field], to[field]))
}

/**
 * Known to known with a new value, or a value the profile listed going away (or appearing) as
 * the read could see. A side the read could not see is never a change.
 */
function changed(from: Known<string>, to: Known<string>): boolean {
  const seen = (value: Known<string>) => !isMissing(value) || value.absent === true
  if (!seen(from) || !seen(to)) return false
  if (isMissing(from) && isMissing(to)) return false
  if (isMissing(from) || isMissing(to)) return true
  return from !== to
}
