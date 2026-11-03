import { describe, expect, it } from 'vitest'
import { absent, missing } from '../src/business'
import { profileChanges, sameProfile } from '../src/history'
import { aBusiness } from './business'

const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`

describe('profile history', () => {
  it('given a renamed profile with a new primary category, then both changes are listed', () => {
    const before = aBusiness()
    const after = aBusiness({
      name: 'Nyack Plumbing Co - Emergency Plumber',
      categories: { primary: 'Emergency plumber', secondary: before.categories.secondary },
    })
    const changes = profileChanges([
      { readAt: at(1), business: before },
      { readAt: at(8), business: after },
    ])
    expect(changes.map((change) => change.field)).toEqual(['name', 'primaryCategory'])
    expect(changes[0]).toMatchObject({
      before: at(1),
      after: at(8),
      from: 'Nyack Plumbing Co',
      to: 'Nyack Plumbing Co - Emergency Plumber',
    })
  })

  it('when a read could not see a field, then that is not a change', () => {
    const signedIn = aBusiness()
    const limitedView = aBusiness({ description: missing('Maps hides it signed out') })
    expect(
      profileChanges([
        { readAt: at(1), business: signedIn },
        { readAt: at(2), business: limitedView },
      ]),
    ).toEqual([])
    expect(sameProfile(signedIn, limitedView)).toBe(true)
  })

  it('when the profile stops listing a phone, then the removal is a change', () => {
    const changes = profileChanges([
      { readAt: at(1), business: aBusiness() },
      { readAt: at(2), business: aBusiness({ phone: absent('The profile lists no phone') }) },
    ])
    expect(changes).toHaveLength(1)
    expect(changes[0]?.field).toBe('phone')
    expect(changes[0]?.to).toMatchObject({ missing: true, absent: true })
  })

  it('given reviews and a closure between reads, then counts and closure change', () => {
    const changes = profileChanges([
      { readAt: at(1), business: aBusiness() },
      { readAt: at(2), business: aBusiness({ reviewCount: 125, closure: 'temporary' }) },
    ])
    expect(changes.map((change) => [change.field, change.from, change.to])).toEqual([
      ['reviewCount', '120', '125'],
      ['closure', 'open', 'temporary'],
    ])
  })
})
