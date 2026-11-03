import { describe, expect, it } from 'vitest'
import { auditProfile, scoreOf } from '../src/audit'
import type { AuditExtras, LocalFinding } from '../src/audit'
import { absent, missing } from '../src/business'
import type { ScanRow } from '../src/compare'
import type { WebsiteCheck } from '../src/nap'
import { NOW, aBusiness, aPost, aReview } from './business'

const SITE: WebsiteCheck = {
  url: 'https://www.nyackplumbing.com/',
  name: { status: 'match', profile: 'Nyack Plumbing Co', found: ['Nyack Plumbing Co'] },
  address: { status: 'match', profile: '250 W Nyack Rd', found: ['250 W Nyack Rd'] },
  phone: { status: 'match', profile: '+18455550100', found: ['845-555-0100'] },
  hours: { status: 'match', profile: 'mon 08:00-17:00', found: ['mon 08:00-17:00'] },
  localSchema: { types: ['Plumber'], missing: [] },
  telLinks: ['+18455550100'],
  embeddedMap: true,
}

function row(
  position: number,
  name: string,
  primary: string,
  secondary: string[],
  reviews: number,
) {
  const entry: ScanRow = {
    position,
    sponsored: false,
    name,
    ids: { placeId: `ChIJ${position}`, cid: null, kgId: null, featureId: null },
    primaryCategory: primary,
    secondaryCategories: secondary,
    rating: 4.7,
    reviewCount: reviews,
    photoCount: null,
    website: null,
    phone: null,
    claimed: null,
    address: null,
    distanceKm: null,
  }
  return entry
}

const RECENT_REVIEWS = Array.from({ length: 12 }, (_, at) =>
  aReview({
    id: `r${at}`,
    publishedAt: `2026-10-${String(at + 1).padStart(2, '0')}T10:00:00Z`,
    ownerReply: {
      text: 'Thanks',
      publishedAt: `2026-10-${String(at + 2).padStart(2, '0')}T10:00:00Z`,
    },
    photoCount: at % 3 === 0 ? 1 : 0,
  }),
)

const FULL: AuditExtras = {
  now: NOW,
  reviews: RECENT_REVIEWS,
  posts: Array.from({ length: 12 }, (_, at) =>
    aPost({ publishedAt: new Date(NOW.getTime() - (at * 7 + 1) * 86_400_000).toISOString() }),
  ),
  website: SITE,
  keyword: 'emergency plumber',
  competitors: [
    row(1, 'Rockland Rooter', 'Plumber', ['Drainage service'], 150),
    row(2, 'Hudson Pipes', 'Plumber', ['Water heater installation service'], 90),
    row(3, 'Valley Drains', 'Plumber', ['Drainage service'], 100),
  ],
  sameAddress: [],
}

function byId(findings: readonly LocalFinding[]): Record<string, LocalFinding> {
  return Object.fromEntries(findings.map((entry) => [entry.checkId, entry]))
}

describe('profile audit', () => {
  it('given a complete, active profile, then every check that applies passes', () => {
    const audit = auditProfile(aBusiness(), FULL)
    const problems = audit.findings.filter((entry) => entry.status !== 'pass')
    expect(problems.map((entry) => [entry.checkId, entry.status])).toEqual([
      // A storefront with no service areas: the service-area rule does not apply.
      ['L37', 'not_applicable'],
    ])
    expect(audit.score).toEqual({ score: 100, judged: 38, untested: 1 })
  })

  it('given a profile whose details were not read, then those checks are not applicable', () => {
    const unread = missing('the panel was still loading')
    const business = aBusiness({
      phone: unread,
      hours: unread,
      claimed: unread,
      rating: unread,
      photoCount: unread,
    })
    const found = byId(auditProfile(business, { now: NOW }).findings)
    for (const id of ['L1', 'L3', 'L4', 'L17', 'L19']) {
      expect(found[id]?.status).toBe('not_applicable')
      expect(found[id]?.severity).toBeNull()
    }
    expect(found['L1']?.summary).toBe('Phone number was not read: the panel was still loading.')
    expect(found['L22']?.summary).toBe('The reviews were not read.')
    expect(found['L30']?.summary).toBe('The website was not read.')
  })

  it('given a profile that lists no phone or description, then those checks fail', () => {
    const none = absent('The profile lists none')
    const found = byId(auditProfile(aBusiness({ phone: none, description: none }), FULL).findings)
    expect(found['L1']).toMatchObject({ status: 'fail', severity: 'high' })
    expect(found['L11']?.status).toBe('fail')
    expect(found['L12']?.status).toBe('not_applicable')
  })

  it('when the name repeats the city and the service, then it is flagged as stuffing', () => {
    const business = aBusiness({ name: 'Best Plumber West Nyack | 24/7 Emergency Plumbing' })
    const stuffing = byId(auditProfile(business, FULL).findings)['L36']
    expect(stuffing?.status).toBe('fail')
    // "nyack" and "plumbing" are in the domain nyackplumbing.com, so they count as the brand.
    expect(stuffing?.evidence.map((entry) => entry.value)).toEqual(['west', 'plumber', 'emergency'])
  })

  it('when the name words are the website domain, then they are the brand', () => {
    const business = aBusiness({ name: 'Nyack Plumbing', website: 'https://nyackplumbing.com' })
    expect(byId(auditProfile(business, FULL).findings)['L36']?.status).toBe('pass')
  })

  it('given competitors that share a category the profile lacks, then the gap is named', () => {
    const competitors = [
      row(1, 'A', 'Plumber', ['Gas installation service'], 150),
      row(2, 'B', 'Plumber', ['Gas installation service'], 90),
      row(3, 'C', 'Heating contractor', ['Gas installation service'], 100),
    ]
    const found = byId(auditProfile(aBusiness(), { ...FULL, competitors }).findings)
    expect(found['L10']).toMatchObject({ status: 'partial' })
    expect(found['L10']?.evidence[0]).toEqual({
      value: 'Gas installation service',
      note: 'used by 3 of 3, as primary by 0',
    })
  })

  it('given unanswered negative reviews, then those within a year are listed', () => {
    const reviews = [
      ...RECENT_REVIEWS,
      aReview({
        id: 'bad',
        rating: 1,
        text: 'Never showed up.',
        ownerReply: null,
        relativeAge: '3 weeks ago',
        publishedAt: null,
      }),
      aReview({ id: 'old', rating: 2, ownerReply: null, publishedAt: '2024-01-01T00:00:00Z' }),
    ]
    const found = byId(auditProfile(aBusiness(), { ...FULL, reviews }).findings)
    expect(found['L25']).toMatchObject({
      status: 'fail',
      summary: '1 negative reviews have no reply.',
    })
    expect(found['L25']?.evidence[0]?.value).toBe('Never showed up.')
  })

  it('given a service-area business with a street address, then it is a risk to review', () => {
    const business = aBusiness({ serviceAreas: ['Rockland County'] })
    expect(byId(auditProfile(business, FULL).findings)['L37']?.status).toBe('partial')
  })

  it('given a temporary closure and a look-alike at the same address, then both fail', () => {
    const business = aBusiness({ closure: 'temporary' })
    const sameAddress = [
      {
        name: 'Nyack Plumbing Co - Emergency',
        ids: { placeId: null, cid: '222', kgId: null, featureId: null },
      },
      { name: 'Nyack Dental', ids: { placeId: null, cid: '333', kgId: null, featureId: null } },
    ]
    const found = byId(auditProfile(business, { ...FULL, sameAddress }).findings)
    expect(found['L38']?.status).toBe('fail')
    expect(found['L39']?.evidence).toEqual([
      { value: 'Nyack Plumbing Co - Emergency', note: '222' },
    ])
  })

  it('given no posts, then posting checks fail and share checks are not applicable', () => {
    const found = byId(auditProfile(aBusiness(), { ...FULL, posts: [] }).findings)
    expect([found['L26']?.status, found['L27']?.status, found['L28']?.status]).toEqual([
      'fail',
      'fail',
      'not_applicable',
    ])
  })

  it('when scoring, then severity weighs and not applicable is left out', () => {
    const findings: LocalFinding[] = [
      {
        checkId: 'L1',
        group: 'profile_basics',
        status: 'fail',
        severity: 'high',
        summary: '',
        evidence: [],
      },
      {
        checkId: 'L12',
        group: 'content',
        status: 'partial',
        severity: 'low',
        summary: '',
        evidence: [],
      },
      {
        checkId: 'L8',
        group: 'categories',
        status: 'pass',
        severity: null,
        summary: '',
        evidence: [],
      },
      {
        checkId: 'L9',
        group: 'categories',
        status: 'not_applicable',
        severity: null,
        summary: '',
        evidence: [],
      },
    ]
    // (0*3 + 0.5*1 + 1*2) / (3 + 1 + 2) = 42%
    expect(scoreOf(findings)).toEqual({ score: 42, judged: 3, untested: 1 })
    expect(scoreOf([]).score).toBeNull()
  })
})
