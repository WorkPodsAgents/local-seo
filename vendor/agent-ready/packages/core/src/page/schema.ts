// A document's JSON-LD (StructuredData.kt) and the properties its entities lack for their type
// (SchemaProperties.kt): a completeness recommendation for agents and search, by presence, never
// a rich-result requirement.

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }

export interface StructuredData {
  readonly blocks: number
  /** Blocks that are not valid JSON (invalid_schema). */
  readonly invalid: number
  /** Every `@type` declared, nested entities included, in order. */
  readonly types: readonly string[]
  /** `Type.property` or `Type.a|b` lacked; null when no block has an entity of a checked type. */
  readonly missing: readonly string[] | null
  /** Every object with a `@type`, at any depth. */
  readonly entities: readonly JsonObject[]
}

export function structuredData(doc: Document): StructuredData {
  let blocks = 0
  let invalid = 0
  const types = new Set<string>()
  const entities: JsonObject[] = []
  const checked: string[][] = []
  for (const script of Array.from(doc.querySelectorAll('script[type]'))) {
    const type = (script.getAttribute('type') ?? '').trim().toLowerCase()
    const text = (script.textContent ?? '').trim()
    if (type !== 'application/ld+json' || text === '') continue
    blocks += 1
    const parsed = parse(text)
    if (parsed === undefined) {
      invalid += 1
      continue
    }
    collect(parsed, types, entities)
    const lacked = missingProperties(parsed)
    if (lacked !== null) checked.push(lacked)
  }
  return {
    blocks,
    invalid,
    types: [...types],
    missing: checked.length === 0 ? null : [...new Set(checked.flat())],
    entities,
  }
}

function parse(text: string): Json | undefined {
  try {
    return JSON.parse(text) as Json
  } catch {
    return undefined
  }
}

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collect(value: Json, types: Set<string>, entities: JsonObject[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collect(item, types, entities)
  } else if (isObject(value)) {
    const own = typesOf(value['@type'])
    for (const type of own) types.add(type)
    if (own.length > 0) entities.push(value)
    for (const child of Object.values(value)) collect(child, types, entities)
  }
}

/** An entity's `@type`s, a type written as its schema.org URL read as the type. */
export function typesOf(value: Json | undefined): string[] {
  const listed = Array.isArray(value) ? value : [value]
  return listed.filter((item): item is string => typeof item === 'string' && item !== '')
}

/** A type written as its schema.org URL is the same type. */
export function bareType(type: string): string {
  return type.replace(/^https?:\/\/schema\.org\//i, '')
}

const ARTICLE = [['headline'], ['author'], ['datePublished']]

/** Each type's recommendations; each is met by any one of its names. */
const RECOMMENDED: ReadonlyMap<string, readonly (readonly string[])[]> = new Map([
  ['Organization', [['name'], ['url']]],
  ['WebSite', [['name'], ['url']]],
  ['Article', ARTICLE],
  ['NewsArticle', ARTICLE],
  ['BlogPosting', ARTICLE],
  ['Service', [['name'], ['provider']]],
  ['FAQPage', [['mainEntity']]],
  ['BreadcrumbList', [['itemListElement']]],
  ['LocalBusiness', [['name'], ['address']]],
  ['Product', [['name'], ['offers', 'review', 'aggregateRating']]],
])

/**
 * Only the block's own entities (the block, an array's items, `@graph`'s members) are judged: a
 * nested value, such as an Article's publisher, needs only what its parent's type asks of it.
 */
function missingProperties(block: Json): string[] | null {
  const checked = ownEntities(block).flatMap((entity) =>
    typesOf(entity['@type'])
      .map(bareType)
      .filter((type) => RECOMMENDED.has(type))
      .map((type) => ({ entity, type })),
  )
  if (checked.length === 0) return null
  return checked.flatMap(({ entity, type }) =>
    (RECOMMENDED.get(type) ?? [])
      .filter((anyOf) => !anyOf.some((name) => has(entity, name)))
      .map((anyOf) => `${type}.${anyOf.join('|')}`),
  )
}

function ownEntities(block: Json): JsonObject[] {
  if (Array.isArray(block)) return block.flatMap(ownEntities)
  if (!isObject(block)) return []
  const graph = block['@graph']
  return Array.isArray(graph) ? graph.filter(isObject) : [block]
}

/** Present with a value: not null, blank, or an empty list or object. */
export function has(entity: JsonObject, name: string): boolean {
  const value = entity[name]
  if (value === undefined || value === null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return String(value).trim() !== ''
}
