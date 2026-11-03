import { describe, expect, it } from 'vitest'
import { auditProfile } from '../src/audit'
import { absent, missing } from '../src/business'
import { profileReport, reportMarkdown } from '../src/report'
import { NOW, aBusiness } from './business'

describe('profile report', () => {
  const business = aBusiness({
    phone: absent('The profile lists none'),
    claimed: false,
    photoCount: 12,
    rating: missing('not shown'),
  })
  const report = profileReport(business, auditProfile(business, { now: NOW }))

  it('given an audit, then fixes list failing checks, high severity and fails first', () => {
    expect(report.fixes.map((fix) => [fix.checkId, fix.severity])).toEqual([
      ['L1', 'high'],
      ['L4', 'high'],
      ['L17', 'medium'],
    ])
    expect(report.fixes[0]?.fix).toMatch(/^Add the main local phone number/)
  })

  it('then the JSON keeps unknown business facts as null and groups findings in order', () => {
    expect(report.business).toMatchObject({ name: 'Nyack Plumbing Co', phone: null, rating: null })
    expect(report.groups.map((group) => group.group)).toEqual([
      'profile_basics',
      'categories',
      'content',
      'photos',
      'reviews',
      'posts',
      'website',
      'trust',
    ])
  })

  it('then the Markdown shows the score, the numbered fixes and each finding', () => {
    const markdown = reportMarkdown(report)
    expect(markdown).toContain(`# Profile audit: Nyack Plumbing Co`)
    expect(markdown).toContain(`Score ${report.score.score}/100 from ${report.score.judged} checks`)
    expect(markdown).toContain('1. **Phone number listed** (high, `L1`): Add the main local phone')
    expect(markdown).toContain('- Rating: unknown')
    expect(markdown).toContain('- Not checked: Rating (`L19`). The rating was not read: not shown.')
  })
})
