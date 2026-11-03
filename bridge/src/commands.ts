// The command line: `audit-website` checks a website against a business's name, address and
// phone in Node, for terminals and CI, `mcp` starts the server an agent talks to, and `pair`
// prints the code that pairs it with the extension.
import { parseArgs } from 'node:util'
import type { LocalFinding } from '@local-seo/core/audit'
import type { WebsiteNapResult } from '@local-seo/core/bridge'
import { pairingCode } from '@local-seo/core/bridge'
import { localCheck } from '@local-seo/core/registry'
import packageJson from '../package.json' with { type: 'json' }
import type { NodeDeps } from './core-adapter'
import { checkWebsiteInNode } from './core-adapter'
import { runMcp } from './mcp'
import { createPairing, readPairing } from './pairing-file'

export interface CliDeps extends NodeDeps {
  /** Where the pairing secret is kept. */
  readonly pairingFile: string
}

const USAGE = `Usage:
  local-seo audit-website <url> --name <name> [--phone <phone>] [--address <address>] [--json]
      Check that the page states the business's name, address and phone as its Google profile
      does, and has LocalBusiness schema, a click-to-call link and a map. A fact left out is not
      compared. Exits 1 when a high-severity check fails or partly fails, so it can gate CI.
  local-seo mcp
      Start the MCP server for Claude Code, Codex and other agents. The first run creates the
      pairing code and prints it on stderr.
  local-seo pair [--reset]
      Print the code that pairs the extension with this computer's bridge; enter it once in the
      extension's Settings, Agent connection. --reset makes a new code, and the extension must
      then be paired again.
  local-seo --version
      Print the version.
`

/** Runs one command and returns its exit code: 0 clean, 1 failing checks, 2 a usage error. */
export async function main(
  argv: readonly string[],
  out: (text: string) => void,
  deps: CliDeps,
): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: false,
    options: {
      version: { type: 'boolean' },
      json: { type: 'boolean' },
      name: { type: 'string' },
      phone: { type: 'string' },
      address: { type: 'string' },
      reset: { type: 'boolean' },
    },
  })
  const [command, url] = positionals
  if (values.version === true) return done(out, `${packageJson.version}\n`, 0)
  if (command === 'mcp') {
    const saved = await readPairing(deps.pairingFile)
    const secret = saved ?? (await createPairing(deps.pairingFile))
    await runMcp(packageJson.version, deps, secret, saved === null)
    return 0
  }
  if (command === 'pair') {
    const saved = values.reset === true ? null : await readPairing(deps.pairingFile)
    const secret = saved ?? (await createPairing(deps.pairingFile))
    return done(out, pairingText(secret, values.reset === true), 0)
  }
  const name = text(values.name)
  if (command === 'audit-website' && url !== undefined && name !== undefined) {
    const facts = { name, phone: text(values.phone), address: text(values.address) }
    const result = await checkWebsiteInNode(deps, url, facts)
    out(values.json === true ? `${JSON.stringify(result, null, 2)}\n` : markdown(result))
    return result.findings.some(failsHigh) ? 1 : 0
  }
  return done(out, USAGE, 2)
}

/** The code and where to enter it. */
function pairingText(secret: Uint8Array, renewed: boolean): string {
  return (
    `Pairing code: ${pairingCode(secret)}\n` +
    'Enter it once in the Local SEO extension: Settings, Agent connection.\n' +
    (renewed ? 'This is a new code; an extension paired before must be paired again.\n' : '')
  )
}

/** parseArgs without strict mode types every value loosely; a flag given bare is not a value. */
function text(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function failsHigh(finding: LocalFinding): boolean {
  return finding.severity === 'high' && (finding.status === 'fail' || finding.status === 'partial')
}

const STATUS = {
  pass: 'Pass',
  partial: 'Partly fails',
  fail: 'Fails',
  not_applicable: 'Not checked',
}

function markdown(result: WebsiteNapResult): string {
  const { website } = result
  const lines = [`# Website NAP check: ${website.url}`, '']
  for (const [label, field] of [
    ['Name', website.name],
    ['Address', website.address],
    ['Phone', website.phone],
    ['Hours', website.hours],
  ] as const) {
    if (field.status === 'profile_missing') {
      lines.push(`- ${label}: not compared, no profile value given`)
      continue
    }
    const found = field.found.length === 0 ? 'nothing' : field.found.slice(0, 3).join(' | ')
    lines.push(
      `- ${label}: ${field.status.replace('_', ' ')}; profile "${field.profile}", ` +
        `site shows ${found}`,
    )
  }
  lines.push('', '## Checks', '')
  for (const finding of result.findings) {
    const severity = finding.severity === null ? '' : `, ${finding.severity}`
    const title = localCheck(finding.checkId).title
    lines.push(
      `- ${STATUS[finding.status]}${severity}: ${title} (\`${finding.checkId}\`). ` +
        finding.summary,
    )
  }
  lines.push('', ...result.notes)
  return lines.join('\n') + '\n'
}

function done(out: (text: string) => void, body: string, code: number): number {
  out(body)
  return code
}
