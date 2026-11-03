// The site-level verdicts on agent files, ported from WorkPods AgentFileChecks.kt. Both files are
// optional: a site without one has nothing to judge, which is not applicable, never a fail.
import type { Evidence, Finding } from '../model'
import type { AgentFile } from './agent-files'
import { count, finding } from './finding'

/** llms_txt_invalid: an llms.txt the site serves opens with no H1. */
export function llmsTxtFinding(files: readonly AgentFile[]): Finding {
  const rows = files.filter((f) => f.kind === 'llms_txt')
  const broken = rows.filter(isBroken)
  const verdict = (status: 'pass' | 'fail' | 'not_applicable', summary: string, cited = rows) =>
    finding('llms_txt_invalid', 'geo', 'ai_readiness', status, summary, cited.map(evidence))
  if (broken.length > 0)
    return verdict('fail', 'The llms.txt does not open with an H1 title.', broken)
  if (rows.some(isPresent)) return verdict('pass', 'The llms.txt opens with an H1 title.')
  if (rows.every(isRead)) return verdict('not_applicable', 'The site has no llms.txt.')
  return verdict('not_applicable', 'The llms.txt could not be read.')
}

/**
 * agent_manifest_invalid: an AI catalog, MCP server card or A2A agent card breaks its standard, a
 * catalog links to a server card that is not there, or the site's only manifest is the legacy
 * ai-plugin.json.
 */
export function agentManifestFinding(files: readonly AgentFile[]): Finding {
  const current = files.filter((f) => f.kind !== 'llms_txt' && f.kind !== 'ai_plugin')
  const plugin = files.filter((f) => f.kind === 'ai_plugin')
  const absent = current.every((f) => f.outcome === 'not_found')
  const legacyOnly = absent ? plugin.filter(isPresent) : []
  const broken = current.filter(isBroken)
  const offending = [...new Set([...broken, ...dangling(current), ...legacyOnly])]
  const deciding = absent ? [...current, ...plugin] : current
  const verdict = (
    status: 'pass' | 'fail' | 'not_applicable',
    summary: string,
    cited: AgentFile[],
  ) =>
    finding('agent_manifest_invalid', 'axo', 'ai_readiness', status, summary, cited.map(evidence))
  if (offending.length > 0) {
    const summary =
      broken.length > 0
        ? `${count(broken.length, 'agent manifest')} on the site break their standard.`
        : legacyOnly.length > 0 && offending.length === legacyOnly.length
          ? 'The only agent manifest on the site is the retired ai-plugin.json.'
          : 'The AI catalog links to an MCP server card that is not there.'
    return verdict('fail', summary, offending)
  }
  const unread = deciding.some((f) => !isRead(f)) || current.some((f) => f.complete === false)
  if (unread) return verdict('not_applicable', 'Some agent manifests could not be read.', [])
  if (deciding.every((f) => f.outcome === 'not_found')) {
    return verdict('not_applicable', 'The site publishes no agent manifest.', [])
  }
  const present = current.filter(isPresent)
  return verdict('pass', `${count(present.length, 'agent manifest')} meet their standard.`, present)
}

/** A catalog that links to a missing card, with that card. */
function dangling(rows: readonly AgentFile[]): AgentFile[] {
  const missing = rows.filter((f) => f.kind === 'mcp_server_card' && f.outcome === 'not_found')
  return missing.length === 0 ? [] : [...rows.filter((f) => f.kind === 'ai_catalog'), ...missing]
}

function isPresent(file: AgentFile): boolean {
  return file.outcome === 'ok'
}

function isBroken(file: AgentFile): boolean {
  return file.outcome === 'ok' && (file.problems?.length ?? 0) > 0
}

/** Read or found absent: it can decide a verdict. */
function isRead(file: AgentFile): boolean {
  return file.outcome === 'ok' || file.outcome === 'not_found'
}

function evidence(file: AgentFile): Evidence {
  const problems = (file.problems ?? []).map((p) =>
    p.field === null ? p.code : `${p.code}: ${p.field}`,
  )
  const note =
    file.outcome !== 'ok'
      ? `${file.outcome}${file.status === null ? '' : ` (HTTP ${file.status})`}`
      : problems.join('; ')
  return note === '' ? { url: file.url } : { url: file.url, note }
}
