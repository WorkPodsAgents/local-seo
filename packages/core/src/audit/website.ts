import { isMissing } from '../business'
import type { FieldCheck, WebsiteCheck } from '../nap'
import type { AuditExtras, CheckFn, LocalFinding } from './finding'
import { finding } from './finding'

/** Website checks need the linked page read. */
function withSite(checkId: string, judge: (site: WebsiteCheck) => LocalFinding): CheckFn {
  return (b, extras: AuditExtras) => {
    if (isMissing(b.website)) {
      return finding(checkId, 'not_applicable', 'The profile links no website.')
    }
    if (extras.website === undefined) {
      return finding(checkId, 'not_applicable', 'The website was not read.')
    }
    return judge(extras.website)
  }
}

const nap = withSite('L30', (site) => {
  const fields: [string, FieldCheck][] = [
    ['name', site.name],
    ['address', site.address],
    ['phone', site.phone],
  ]
  const compared = fields.filter(([, field]) => field.status !== 'profile_missing')
  const evidence = compared.map(([label, field]) => ({
    url: site.url,
    value: field.found.slice(0, 3).join(' | ') || '(not on the page)',
    note: `${label}: ${field.status.replace('_', ' ')}, profile has "${field.profile}"`,
  }))
  const wrong = compared.filter(([, field]) => field.status === 'mismatch').map(([label]) => label)
  if (wrong.length > 0) {
    return finding('L30', 'fail', `The website shows a different ${wrong.join(' and ')}.`, evidence)
  }
  const missing = compared.filter(([, f]) => f.status === 'not_found').map(([label]) => label)
  if (missing.length === 0) {
    return finding('L30', 'pass', 'The website matches the profile.', evidence)
  }
  const status = missing.length === compared.length ? 'fail' : 'partial'
  return finding('L30', status, `The website does not show the ${missing.join(' or ')}.`, evidence)
})

const schema = withSite('L31', (site) =>
  site.localSchema === null
    ? finding('L31', 'fail', 'The page has no LocalBusiness schema.', [{ url: site.url }])
    : finding('L31', 'pass', `The page declares ${site.localSchema.types.join(', ')}.`),
)

const schemaComplete = withSite('L32', (site) => {
  if (site.localSchema === null) {
    return finding('L32', 'not_applicable', 'There is no LocalBusiness schema to judge.')
  }
  const lacked = site.localSchema.missing
  if (lacked.length === 0) return finding('L32', 'pass', 'The LocalBusiness schema is complete.')
  const summary = `The LocalBusiness schema lacks ${lacked.join(', ')}.`
  return finding('L32', 'partial', summary, [{ url: site.url }])
})

const telLink = withSite('L33', (site) =>
  site.telLinks.length > 0
    ? finding('L33', 'pass', 'The page has a click-to-call link.', [
        { value: site.telLinks[0] ?? '' },
      ])
    : finding('L33', 'fail', 'The page has no tel: link.', [{ url: site.url }]),
)

const hours = withSite('L34', (site) => {
  const field = site.hours
  if (field.status === 'profile_missing') {
    return finding('L34', 'not_applicable', 'The profile hours are not known.')
  }
  if (field.status === 'not_found') {
    return finding('L34', 'not_applicable', 'The page declares no hours in its schema.')
  }
  const evidence = [{ value: field.found.join('; '), note: `profile: ${field.profile}` }]
  return field.status === 'match'
    ? finding('L34', 'pass', 'The website hours match the profile.', evidence)
    : finding('L34', 'fail', 'The website hours differ from the profile.', evidence)
})

const map = withSite('L35', (site) =>
  site.embeddedMap
    ? finding('L35', 'pass', 'The page embeds a Google map.')
    : finding('L35', 'fail', 'The page embeds no Google map.', [{ url: site.url }]),
)

export const WEBSITE: readonly CheckFn[] = [nap, schema, schemaComplete, telLink, hours, map]
