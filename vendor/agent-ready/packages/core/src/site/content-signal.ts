// Content-Signal (contentsignals.org, as Cloudflare's managed robots.txt writes it), ported from
// WorkPods ContentSignal.kt. Conflicting declarations are all kept: which applies is the reader's
// call.

/** One declaration of what the site allows its content to be used for. */
export interface ContentSignal {
  /**
   * The robots.txt group it sits in, its user-agent tokens joined by ", " ("*" is the whole
   * site); null for a response header.
   */
  readonly group: string | null
  /** search, ai-input, ai-train, or a name not interpreted, such as use. */
  readonly signal: string
  /** The value as written, lower-cased (yes, no, reference). */
  readonly value: string
  /** True for yes, false for no, null for a value not interpreted. */
  readonly allowed: boolean | null
}

const MAX_SIGNALS = 20
const NAME = /^[a-z][a-z0-9-]{0,39}$/
const VALUE = /^[a-z0-9._-]{1,40}$/

/**
 * The declarations of one header value or robots.txt line (`search=yes, ai-train=no`) in
 * `group`; a pair that is not a name with a token value is skipped.
 */
export function parseContentSignal(value: string, group: string | null): ContentSignal[] {
  const found: ContentSignal[] = []
  const seen = new Set<string>()
  for (const pair of value.split(',')) {
    const at = pair.indexOf('=')
    const name = (at < 0 ? pair : pair.slice(0, at)).trim().toLowerCase()
    const said =
      at < 0
        ? ''
        : pair
            .slice(at + 1)
            .trim()
            .toLowerCase()
    const key = `${name}=${said}`
    if (!NAME.test(name) || !VALUE.test(said) || seen.has(key)) continue
    seen.add(key)
    found.push({ group, signal: name, value: said, allowed: interpret(said) })
  }
  return found.slice(0, MAX_SIGNALS)
}

function interpret(value: string): boolean | null {
  if (value === 'yes') return true
  if (value === 'no') return false
  return null
}
