// missing_organization_identity: whether the home page names the organization in structured data
// that crawlers running no JavaScript can read, graded by the registry rubric.
import type { Finding } from '../model'
import { finding } from './page-checks'
import type { PageRead } from './read'
import { bareType, has, typesOf } from './schema'
import type { JsonObject } from './schema'

/** Organization and the schema.org subtypes sites use for themselves. */
const ORGANIZATION_TYPES = new Set([
  'Organization',
  'Corporation',
  'LocalBusiness',
  'OnlineBusiness',
  'OnlineStore',
  'Store',
  'ProfessionalService',
  'NGO',
  'EducationalOrganization',
  'CollegeOrUniversity',
  'School',
  'GovernmentOrganization',
  'MedicalOrganization',
  'NewsMediaOrganization',
  'SportsOrganization',
  'PerformingGroup',
  'Airline',
  'Consortium',
  'Cooperative',
  'ResearchOrganization',
  'LibrarySystem',
  'FundingScheme',
  'WorkersUnion',
  'PoliticalParty',
  'Project',
  'SearchRescueOrganization',
  'Restaurant',
  'Hotel',
  'Dentist',
  'LegalService',
  'FinancialService',
  'RealEstateAgent',
  'TravelAgency',
  'AutoDealer',
  'HealthAndBeautyBusiness',
  'HomeAndConstructionBusiness',
  'EmploymentAgency',
])

/** What the rubric's low grade asks beyond the name: a logo, profiles and contact details. */
const DETAILS: readonly (readonly string[])[] = [
  ['logo'],
  ['sameAs'],
  ['contactPoint', 'telephone', 'email'],
]

export function organizationIdentity(page: PageRead, brandName: string | null): Finding {
  const id = 'missing_organization_identity'
  if (!isHome(page.snapshot.url)) {
    return finding(id, 'not_applicable', 'Only the home page is checked for this.')
  }
  if (!page.ok) {
    const summary = `The page answered ${page.snapshot.status}, so this was not checked.`
    return finding(id, 'not_applicable', summary)
  }
  const raw = organizations(page.raw.schema.entities)
  const rendered = page.rendered === null ? [] : organizations(page.rendered.schema.entities)
  const found = raw[0] ?? rendered[0]
  if (found === undefined) {
    const summary = 'The home page has no Organization schema.'
    return finding(id, 'fail', summary, [], 'medium')
  }
  const name = nameOf(found)
  const evidence = [{ value: name ?? '(no name)', note: typesOf(found['@type']).join(', ') }]
  if (raw.length === 0) {
    const summary = 'The Organization schema appears only after JavaScript runs.'
    return finding(id, 'fail', summary, evidence, 'medium')
  }
  if (brandName !== null && name !== null && !sameBrand(name, brandName)) {
    const summary = `The Organization schema names "${name}", not ${brandName}.`
    return finding(id, 'fail', summary, evidence, 'critical')
  }
  const lacked = DETAILS.filter((anyOf) => !anyOf.some((field) => has(found, field)))
  if (lacked.length > 0) {
    const missing = lacked.map((anyOf) => anyOf.join(' or ')).join(', ')
    return finding(id, 'partial', `The Organization schema lacks ${missing}.`, evidence, 'low')
  }
  return finding(id, 'pass', 'The home page identifies the organization in its schema.', evidence)
}

function isHome(url: string): boolean {
  try {
    return new URL(url).pathname === '/'
  } catch {
    return false
  }
}

function organizations(entities: readonly JsonObject[]): JsonObject[] {
  return entities.filter((entity) =>
    typesOf(entity['@type']).some((type) => ORGANIZATION_TYPES.has(bareType(type))),
  )
}

function nameOf(entity: JsonObject): string | null {
  const name = entity['name']
  const first = Array.isArray(name) ? name[0] : name
  return typeof first === 'string' && first.trim() !== '' ? first.trim() : null
}

/** "Acme Running Co." names Acme Running: either name holds the other, ignoring case and marks. */
function sameBrand(name: string, brand: string): boolean {
  const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
  const a = plain(name)
  const b = plain(brand)
  return a !== '' && b !== '' && (a.includes(b) || b.includes(a))
}
