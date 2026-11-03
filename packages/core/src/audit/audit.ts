import type { Business } from '../business'
import { CATEGORIES } from './categories'
import { CONTENT } from './content'
import type { AuditExtras, LocalFinding } from './finding'
import { PHOTOS } from './photos'
import { POSTS } from './posts'
import { PROFILE_BASICS } from './profile-basics'
import { REVIEWS } from './reviews'
import type { ProfileScore } from './score'
import { scoreOf } from './score'
import { TRUST } from './trust'
import { WEBSITE } from './website'

const CHECKS = [
  ...PROFILE_BASICS,
  ...CATEGORIES,
  ...CONTENT,
  ...PHOTOS,
  ...REVIEWS,
  ...POSTS,
  ...WEBSITE,
  ...TRUST,
]

export interface ProfileAudit {
  /** Registry order. */
  readonly findings: readonly LocalFinding[]
  readonly score: ProfileScore
}

/** Every local check against `business`; a check missing its input is not applicable. */
export function auditProfile(business: Business, extras: AuditExtras): ProfileAudit {
  const findings = CHECKS.map((check) => check(business, extras))
  return { findings, score: scoreOf(findings) }
}
