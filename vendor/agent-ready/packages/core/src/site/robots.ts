// robots.txt as Google reads it (RFC 9309), ported from WorkPods RobotsTxt.kt and RobotsRules.kt.
import type { RobotsPolicy } from '../model'
import { parseContentSignal, type ContentSignal } from './content-signal'

/** One group: the agents it names and its patterns. */
export interface RobotsGroup {
  readonly userAgents: readonly string[]
  readonly allow: readonly string[]
  readonly disallow: readonly string[]
}

/**
 * What the fetch of the file allows before any group is read: a 2xx file is parsed, any 4xx
 * allows everything, and a 5xx, a 429 or no answer disallows everything for now.
 */
export type RobotsAvailability = 'parsed' | 'allow_all' | 'disallow_all'

/** A parsed robots.txt with the facts the site report shows. */
export interface RobotsFile extends RobotsPolicy {
  readonly availability: RobotsAvailability
  readonly groups: readonly RobotsGroup[]
  readonly contentSignals: readonly ContentSignal[]
}

const MAX_SIGNALS = 50

/** Parses robots.txt as Google does: longest match wins, Allow wins a tie. */
export function parseRobots(text: string): RobotsFile {
  return readRobots('parsed', text)
}

/** The rules a fetch of robots.txt leaves: `status` null means no answer. */
export function robotsFromAnswer(status: number | null, text: string): RobotsFile {
  return readRobots(availability(status), status !== null && status < 300 ? text : '')
}

function availability(status: number | null): RobotsAvailability {
  if (status === null || status === 429) return 'disallow_all'
  if (status >= 200 && status < 300) return 'parsed'
  if (status >= 400 && status < 500) return 'allow_all'
  return 'disallow_all'
}

function readRobots(availability: RobotsAvailability, text: string): RobotsFile {
  const sitemaps: string[] = []
  const signals: ContentSignal[] = []
  const reader = new GroupReader()
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const hash = raw.indexOf('#')
    const line = (hash < 0 ? raw : raw.slice(0, hash)).trim()
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (key === 'user-agent') reader.agent(value)
    else if (key === 'allow') reader.rule(value, true)
    else if (key === 'disallow') reader.rule(value, false)
    else if (key === 'sitemap' && value !== '') sitemaps.push(value)
    else if (key === 'content-signal') signals.push(...parseContentSignal(value, reader.group()))
  }
  const groups = reader.done()
  return {
    availability,
    groups,
    sitemaps: [...new Set(sitemaps)],
    contentSignals: distinctSignals(signals).slice(0, MAX_SIGNALS),
    allows: (userAgent, url) => allows(availability, groups, userAgent, url),
  }
}

function distinctSignals(signals: readonly ContentSignal[]): ContentSignal[] {
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = `${s.group ?? ''}\t${s.signal}=${s.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Consecutive user-agent lines open one group; a rule before any agent belongs to `*`. A
 * Content-Signal line does not end a group's agent list, as no unknown line does.
 */
class GroupReader {
  private readonly groups: RobotsGroup[] = []
  private agents: string[] = []
  private allow: string[] = []
  private disallow: string[] = []
  private ruled = false

  group(): string {
    return (this.agents.length > 0 ? this.agents : ['*']).join(', ')
  }

  agent(value: string): void {
    if (this.ruled) this.flush()
    if (value !== '') this.agents.push(value)
  }

  rule(value: string, allow: boolean): void {
    if (this.agents.length === 0) this.agents.push('*')
    this.ruled = true
    if (value === '') return
    if (allow) this.allow.push(value)
    else this.disallow.push(value)
  }

  done(): RobotsGroup[] {
    this.flush()
    return this.groups
  }

  private flush(): void {
    if (this.agents.length > 0) {
      this.groups.push({ userAgents: this.agents, allow: this.allow, disallow: this.disallow })
    }
    this.agents = []
    this.allow = []
    this.disallow = []
    this.ruled = false
  }
}

function allows(
  availability: RobotsAvailability,
  groups: readonly RobotsGroup[],
  agent: string,
  pathOrUrl: string,
): boolean {
  if (availability === 'allow_all') return true
  if (availability === 'disallow_all') return false
  return decide(pathOf(pathOrUrl), applying(groups, agent))
}

/** The groups naming the agent's product token, else the `*` groups, merged. */
function applying(groups: readonly RobotsGroup[], agent: string): RobotsGroup[] {
  const token = productToken(agent)
  const named = groups.filter((g) => g.userAgents.some((ua) => productToken(ua) === token))
  return named.length > 0 ? named : groups.filter((g) => g.userAgents.includes('*'))
}

function decide(path: string, groups: readonly RobotsGroup[]): boolean {
  let best = -1
  let allowed = true
  for (const group of groups) {
    for (const pattern of group.allow) {
      if (matches(path, pattern) && pattern.length >= best) {
        best = pattern.length
        allowed = true
      }
    }
    for (const pattern of group.disallow) {
      if (matches(path, pattern) && pattern.length > best) {
        best = pattern.length
        allowed = false
      }
    }
  }
  return allowed
}

/**
 * The token of a user-agent line or a crawler's name: its leading run of letters, `_` and `-`,
 * so `Googlebot/2.1` is `googlebot`.
 */
export function productToken(agent: string): string {
  const trimmed = agent.trim()
  const lead = /^[\p{L}_-]*/u.exec(trimmed)?.[0] ?? ''
  return (lead === '' ? trimmed : lead).toLowerCase()
}

function matches(path: string, pattern: string): boolean {
  if (pattern === '') return false
  const anchored = pattern.endsWith('$')
  const core = anchored ? pattern.slice(0, -1) : pattern
  const body = core
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path)
}

function pathOf(pathOrUrl: string): string {
  const text = pathOrUrl.trim()
  if (text.startsWith('/')) return text
  try {
    const url = new URL(text)
    return (url.pathname === '' ? '/' : url.pathname) + url.search
  } catch {
    return '/'
  }
}
