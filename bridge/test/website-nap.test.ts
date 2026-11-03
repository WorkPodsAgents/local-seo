// The website check runs in Node when no extension is connected: from the MCP tool when the
// agent passes the page and the profile facts, and from the CLI in CI.
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { EXTENSION_ORIGIN, newPairingSecret } from '@local-seo/core/bridge'
import type { WebsiteNapResult } from '@local-seo/core/bridge'
import type { Fetcher } from '@open-agent-ready/core'
import { main } from '../src/commands'
import type { NodeDeps } from '../src/core-adapter'
import { ExtensionLink } from '../src/extension-link'
import { createMcpServer } from '../src/mcp'
import { parseHtml } from '../src/node-io'

const PAGE_URL = 'https://www.nyackplumbing.com/'
const PAGE = readFileSync(new URL('./fixtures/location-page.html', import.meta.url), 'utf8')

/** Serves the saved location page at PAGE_URL and a 404 anywhere else. */
const savedSite: Fetcher = {
  fetch: async ({ url }) =>
    url === PAGE_URL
      ? { url, status: 200, headers: { 'content-type': 'text/html' }, body: PAGE }
      : { url, status: 404, headers: { 'content-type': 'text/plain' }, body: 'Not found' },
}

const deps: NodeDeps = {
  fetcher: savedSite,
  parse: parseHtml,
  now: () => new Date('2026-11-02T12:00:00Z'),
}

const PROFILE = {
  name: 'Nyack Plumbing Co',
  phone: '+1 845-555-0100',
  address: '250 W Nyack Rd #200, West Nyack, NY 10994',
}

const links: ExtensionLink[] = []

afterEach(async () => {
  await Promise.all(links.splice(0).map((link) => link.close()))
})

/** An agent whose bridge has no extension connected. */
async function agentWithoutExtension(): Promise<Client> {
  const port = 40_000 + Math.floor(Math.random() * 20_000)
  const link = new ExtensionLink({
    port,
    allowedOrigin: EXTENSION_ORIGIN,
    secret: newPairingSecret(),
    log: () => {},
  })
  links.push(link)
  await link.listening()
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await createMcpServer(link, 'test', deps).connect(serverSide)
  const client = new Client({ name: 'test-agent', version: '1' })
  await client.connect(clientSide)
  return client
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const [first] = result.content as { type: string; text: string }[]
  return first?.text ?? ''
}

describe('check_website_nap without the extension', () => {
  it('checks the page against the profile facts the agent passed', async () => {
    const client = await agentWithoutExtension()

    const result = await client.callTool({
      name: 'check_website_nap',
      arguments: { url: PAGE_URL, profile: PROFILE },
    })

    const check = JSON.parse(textOf(result)) as WebsiteNapResult
    expect(result.isError).toBeFalsy()
    expect(check.profileFrom).toBe('arguments')
    expect(check.website.name.status).toBe('match')
    expect(check.website.address.status).toBe('match')
    expect(check.website.phone.status).toBe('match')
    expect(check.website.localSchema?.types).toEqual(['Plumber'])
    expect(check.findings.map((entry) => [entry.checkId, entry.status])).toEqual([
      ['L30', 'pass'],
      ['L31', 'pass'],
      ['L32', 'pass'],
      ['L33', 'pass'],
      // The hours were not passed, so there is nothing to compare them with.
      ['L34', 'not_applicable'],
      ['L35', 'pass'],
    ])
    expect(check.notes.join(' ')).toContain('without a browser')
  })

  it('asks for the extension when the agent passes a business but no profile facts', async () => {
    const client = await agentWithoutExtension()

    const result = await client.callTool({
      name: 'check_website_nap',
      arguments: { business: { cid: '111' }, url: PAGE_URL },
    })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('The Local SEO extension is not connected')
  })
})

async function auditWebsite(...flags: string[]): Promise<{ code: number; output: string }> {
  let output = ''
  const cli = { ...deps, pairingFile: 'unused by audit-website' }
  const code = await main(['audit-website', PAGE_URL, ...flags], (text) => (output += text), cli)
  return { code, output }
}

describe('local-seo audit-website in CI', () => {
  it('exits 0 when the site states the same name, address and phone', async () => {
    const { code, output } = await auditWebsite(
      '--name',
      PROFILE.name,
      '--phone',
      PROFILE.phone,
      '--address',
      PROFILE.address,
    )

    expect(code).toBe(0)
    expect(output).toContain('Pass: Website matches name, address and phone (`L30`)')
  })

  it('exits 1 when the site shows a different phone, a high-severity failure', async () => {
    const { code, output } = await auditWebsite('--name', PROFILE.name, '--phone', '0845 999 1234')

    expect(code).toBe(1)
    expect(output).toContain('Fails, high: Website matches name, address and phone (`L30`)')
  })

  it('prints the result as JSON with --json', async () => {
    const { output } = await auditWebsite('--name', PROFILE.name, '--json')

    expect((JSON.parse(output) as WebsiteNapResult).website.url).toBe(PAGE_URL)
  })

  it('exits 2 with the usage when --name is missing', async () => {
    const { code, output } = await auditWebsite('--phone', PROFILE.phone)

    expect(code).toBe(2)
    expect(output).toContain('Usage:')
  })
})
