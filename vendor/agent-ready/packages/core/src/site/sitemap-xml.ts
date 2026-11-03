// Sitemap and sitemap index parsing, ported from WorkPods SitemapXml.kt. A small tokenizer stands
// in for an XML parser because DOMParser does not exist in a service worker; only <loc> inside
// <url> or <sitemap> matters, and entities and doctypes are never expanded.

/** A parsed sitemap: an index lists child sitemaps, a urlset lists page URLs. */
export interface ParsedSitemap {
  readonly index: boolean
  readonly locs: readonly string[]
  /** The whole urlset or index was read; malformed or truncated XML cannot show a URL left. */
  readonly complete: boolean
}

const PREFIX = '(?:[A-Za-z_][\\w.-]*:)?'
const ROOT = new RegExp(`<(${PREFIX})(urlset|sitemapindex)\\b[^>]*>`)

export function parseSitemap(xml: string): ParsedSitemap {
  const text = xml.replace(/<!--[\s\S]*?-->/g, '')
  const root = ROOT.exec(text)
  if (root === null) return { index: false, locs: [], complete: false }
  const prefix = root[1] ?? ''
  const name = root[2] ?? ''
  const index = name === 'sitemapindex'
  const item = index ? 'sitemap' : 'url'
  const body = text.slice(root.index + root[0].length)
  const close = body.indexOf(`</${prefix}${name}>`)
  const inside = close < 0 ? body : body.slice(0, close)
  const locs: string[] = []
  const items = new RegExp(
    `<${escape(prefix)}${item}\\b[^>]*>([\\s\\S]*?)</${escape(prefix)}${item}>`,
    'g',
  )
  for (const match of inside.matchAll(items)) {
    // Only the item's own <loc>: an <image:loc> or <video:loc> names media, not the page.
    const own = new RegExp(`<${escape(prefix)}loc>([\\s\\S]*?)</${escape(prefix)}loc>`).exec(
      match[1] ?? '',
    )
    const loc = decode((own?.[1] ?? '').trim())
    if (loc !== '') locs.push(loc)
  }
  return { index, locs, complete: close >= 0 }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function decode(text: string): string {
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(text)
  if (cdata !== null) return (cdata[1] ?? '').trim()
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (!name.startsWith('#')) return ENTITIES[name.toLowerCase()] ?? whole
    const hex = name[1] === 'x' || name[1] === 'X'
    const point = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10)
    return point <= MAX_CODE_POINT ? String.fromCodePoint(point) : whole
  })
}

const MAX_CODE_POINT = 0x10ffff
