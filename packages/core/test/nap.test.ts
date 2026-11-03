// The website check through the vendored Fetcher and HtmlParser seams, parsed with linkedom as
// the CLI does.
import { fetchPage } from '@open-agent-ready/core/page'
import type { HtmlParser } from '@open-agent-ready/core'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { checkWebsite, normalizeAddress, normalizePhone, samePhone } from '../src/nap'
import { aBusiness } from './business'

const parse: HtmlParser = (html) => parseHTML(html).document as unknown as Document

async function siteWith(body: string) {
  const html = `<html><head><title>Home</title></head><body>${body}</body></html>`
  const fetcher = {
    fetch: async () => ({
      url: 'https://www.nyackplumbing.com/',
      status: 200,
      headers: {},
      body: html,
    }),
  }
  return checkWebsite(
    aBusiness(),
    await fetchPage(fetcher, parse, 'https://www.nyackplumbing.com/'),
  )
}

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Plumber',
  name: 'Nyack Plumbing Co.',
  telephone: '+1 (845) 555-0100',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '250 West Nyack Road, Suite 200',
    addressLocality: 'West Nyack',
    postalCode: '10994',
  },
  geo: { '@type': 'GeoCoordinates', latitude: 41.0973, longitude: -73.9934 },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '17:00',
    },
  ],
}

describe('website NAP check', () => {
  it('given matching schema, a tel: link and a map, then every field matches', async () => {
    const site = await siteWith(`
      <script type="application/ld+json">${JSON.stringify(SCHEMA)}</script>
      <a href="tel:+18455550100">Call us</a>
      <iframe src="https://www.google.com/maps/embed?pb=!1m18"></iframe>`)
    expect([site.name.status, site.address.status, site.phone.status, site.hours.status]).toEqual([
      'match',
      'match',
      'match',
      'match',
    ])
    expect(site.localSchema).toEqual({ types: ['Plumber'], missing: [] })
    expect(site.telLinks).toEqual(['+18455550100'])
    expect(site.embeddedMap).toBe(true)
  })

  it('given another phone and hours, then they are mismatches with evidence', async () => {
    const schema = { ...SCHEMA, telephone: '845-555-0199', openingHours: 'Mo-Sa 09:00-18:00' }
    delete (schema as Record<string, unknown>)['openingHoursSpecification']
    const site = await siteWith(
      `<script type="application/ld+json">${JSON.stringify(schema)}</script>` +
        '<p>Call 845.555.0199</p>',
    )
    expect(site.phone).toEqual({
      status: 'mismatch',
      profile: '+18455550100',
      found: ['845-555-0199', '845.555.0199'],
    })
    expect(site.hours.status).toBe('mismatch')
    expect(site.hours.found[5]).toBe('sat 09:00-18:00')
    expect(site.embeddedMap).toBe(false)
  })

  it('given a page with no details, then fields are not found, not mismatched', async () => {
    const site = await siteWith('<h1>Welcome</h1><p>Opened 2019-04-01.</p>')
    expect([site.address.status, site.phone.status, site.hours.status]).toEqual([
      'not_found',
      'not_found',
      'not_found',
    ])
    expect(site.localSchema).toBeNull()
  })

  it('given a copyright range and a ZIP+4, then neither is read as a phone', async () => {
    const site = await siteWith(
      '<footer>© 2019-2024 Nyack Plumbing Co · West Nyack, NY 10994-1234</footer>',
    )
    expect(site.phone).toEqual({ status: 'not_found', profile: '+18455550100', found: [] })
  })

  it('given another number only in text, then the phone is not found, not mismatched', async () => {
    const site = await siteWith('<p>Our partner supply store: (845) 555-0177</p>')
    expect(site.phone).toEqual({
      status: 'not_found',
      profile: '+18455550100',
      found: ['(845) 555-0177'],
    })
  })

  it('given a suite or another house number, then only number and street decide', async () => {
    const schema = (streetAddress: string) =>
      siteWith(
        `<script type="application/ld+json">${JSON.stringify({
          ...SCHEMA,
          address: { ...SCHEMA.address, streetAddress },
        })}</script>`,
      )
    expect((await schema('250 W Nyack Rd, Suite 310')).address.status).toBe('match')
    expect((await schema('1250 W Nyack Rd')).address.status).toBe('mismatch')
  })

  it('given the name inside another word, then the name is not found', async () => {
    const site = await siteWith('<p>The Nyack Plumbing Company store</p>')
    expect(site.name.status).toBe('not_found')
  })

  it('given the address only as text, then it matches after normalising', async () => {
    const site = await siteWith('<footer>250 W. Nyack Road, Ste 200, West Nyack NY</footer>')
    expect(site.address.status).toBe('match')
  })
})

describe('normalising', () => {
  it('then phones compare with or without a country code', () => {
    expect(normalizePhone('+1 (877) 467-8789')).toBe('+18774678789')
    expect(samePhone('+1 877-467-8789', '(877) 467 8789')).toBe(true)
    expect(samePhone('+44 20 7946 0958', '020 7946 0958')).toBe(true)
    expect(samePhone('555-0100', '555-0199')).toBe(false)
  })

  it('then addresses compare with street words abbreviated', () => {
    expect(normalizeAddress('250 West Nyack Road, Suite 200')).toBe('250 w nyack rd ste 200')
    expect(normalizeAddress('250 W Nyack Rd #200')).toBe('250 w nyack rd ste 200')
  })
})
