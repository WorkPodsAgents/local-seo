// Every tool the bridge offers an agent: its input schema. Agents see only a tool's name,
// description and input schema, so each field says what it means, its allowed values, its
// default and its format. The shapes mirror ToolArgs in the core's bridge protocol.
import { z } from 'zod'
import { LIMITS } from '@local-seo/core/bridge'
import type { ToolArgs, ToolName } from '@local-seo/core/bridge'

const point = (what: string) =>
  z
    .object({
      lat: z.number().min(-90).max(90).describe('Latitude in decimal degrees, -90 to 90.'),
      lng: z.number().min(-180).max(180).describe('Longitude in decimal degrees, -180 to 180.'),
    })
    .describe(what)

const business = z
  .union([
    z.object({
      mapsUrl: z
        .string()
        .url()
        .describe('A Google Maps link to the place, such as https://maps.app.goo.gl/... .'),
    }),
    z.object({ placeId: z.string().min(1).describe('A Google place id, such as "ChIJ...".') }),
    z.object({
      cid: z
        .string()
        .regex(/^\d+$/)
        .describe('A Google customer id (CID), decimal digits, as in maps.google.com/?cid=.'),
    }),
    z.object({
      name: z.string().min(1).describe('The business name as Google shows it.'),
      city: z.string().min(1).describe('The town or city it is in, such as "Leeds, UK".'),
    }),
  ])
  .describe(
    'Which business: exactly one of {mapsUrl}, {placeId}, {cid} or {name, city}. Ids from ' +
      'find_business or local_scan are exact; a name and city is searched in Maps and can match ' +
      'a different place with the same name.',
  )

const near = z
  .union([point('A point.'), z.string().min(1)])
  .optional()
  .describe(
    'Where the search is seen from: {lat, lng}, or a place name such as "West Nyack, NY" that ' +
      "is looked up in Maps. Defaults to Maps' own view, which is usually the user's location.",
  )

const source = z
  .enum(['browser', 'dataforseo'])
  .optional()
  .describe(
    "browser (the default) reads Maps in the user's Chrome for free. dataforseo pays from the " +
      "user's DataForSEO key kept in the extension, within the monthly cap set there.",
  )

const query = (example: string) =>
  z.string().min(1).describe(`The search as a customer types it into Maps, such as "${example}".`)

const zoom = z
  .number()
  .int()
  .min(LIMITS.zoom.min)
  .max(LIMITS.zoom.max)
  .optional()
  .describe(
    `The Maps zoom level, ${LIMITS.zoom.min} to ${LIMITS.zoom.max}; higher is closer in. ` +
      `Defaults to ${LIMITS.zoom.default}, about a neighbourhood across.`,
  )

export const SHAPES = {
  find_business: { query: query('Nyack Plumbing Co'), near },
  audit_profile: {
    business,
    keyword: z
      .string()
      .min(1)
      .optional()
      .describe(
        'The search the business wants to rank for, such as "emergency plumber". Used by the ' +
          'relevance checks and, with include competitors, as the competitor search. Defaults ' +
          'to none, which leaves the keyword checks not_applicable.',
      ),
    include: z
      .array(z.enum(['reviews', 'posts', 'website', 'competitors']))
      .optional()
      .describe(
        'What to read beyond the profile: reviews, posts, website (the linked page, for the ' +
          'NAP and schema checks) and competitors (the Maps results for keyword, or for the ' +
          'primary category without one). Defaults to ["reviews", "posts", "website"]. A part ' +
          'left out makes its checks not_applicable.',
      ),
  },
  read_reviews: {
    business,
    max: z
      .number()
      .int()
      .min(1)
      .max(LIMITS.reviews.max)
      .optional()
      .describe(
        `The most reviews to read, 1 to ${LIMITS.reviews.max}, newest first. Defaults to ` +
          `${LIMITS.reviews.default}. With dataforseo, cost grows per 10 reviews.`,
      ),
    source,
    cursor: z
      .string()
      .optional()
      .describe(
        'The nextCursor from an earlier read_reviews call, to get the next page of that same ' +
          'read without reading Maps again. Pass the same business with it. Defaults to none, ' +
          'which starts a new read.',
      ),
  },
  read_posts: {
    business,
    max: z
      .number()
      .int()
      .min(1)
      .max(LIMITS.posts.max)
      .optional()
      .describe(
        `The most posts to read, 1 to ${LIMITS.posts.max}, newest first. Defaults to ` +
          `${LIMITS.posts.default}.`,
      ),
    source,
  },
  local_scan: {
    query: query('emergency plumber'),
    near,
    max: z
      .number()
      .int()
      .min(1)
      .max(LIMITS.scan.max)
      .optional()
      .describe(
        `The most results to read, 1 to ${LIMITS.scan.max}. Defaults to ${LIMITS.scan.default}.`,
      ),
    withDetails: z
      .boolean()
      .optional()
      .describe(
        "Open each result's profile for its secondary categories, photo count, website, phone " +
          'and claimed state; slow, a few seconds per result. Defaults to false, which leaves ' +
          'those fields null.',
      ),
  },
  rank_at: {
    query: query('emergency plumber'),
    business,
    at: point('The point to search from, as if the customer stood there.'),
    zoom,
  },
  geo_grid: {
    query: query('emergency plumber'),
    business,
    center: point('The middle of the grid, usually the business location.'),
    size: z
      .number()
      .int()
      .min(LIMITS.grid.minSize)
      .max(LIMITS.grid.maxSize)
      .refine((value) => value % 2 === 1, 'size must be odd')
      .describe(
        `Points per side, odd, ${LIMITS.grid.minSize} to ${LIMITS.grid.maxSize}: 5 makes 25 ` +
          `points. The browser source allows at most ${LIMITS.grid.browserMaxSize}.`,
      ),
    spacingKm: z
      .number()
      .positive()
      .max(50)
      .describe(
        'Kilometres between neighbouring points, more than 0 and at most 50. A 7x7 grid at ' +
          '1 km spans 6 km.',
      ),
    source,
    zoom,
    estimateOnly: z
      .boolean()
      .optional()
      .describe(
        'Return only estimatedCostUsd and read nothing, so the user can approve the spend ' +
          'first. Defaults to false.',
      ),
  },
  category_ideas: {
    business: business
      .optional()
      .describe(
        'The business to find categories for: {mapsUrl}, {placeId}, {cid} or {name, city}. Its ' +
          'primary category is the search when query is not given, and missing lists what it ' +
          'lacks. Give business, query, or both.',
      ),
    query: z
      .string()
      .min(1)
      .optional()
      .describe(
        'The search whose top results are read, such as "plumber". Defaults to the ' +
          "business's primary category.",
      ),
    near,
    searchVolumes: z
      .boolean()
      .optional()
      .describe(
        'Add monthly search volumes for each category name, a paid DataForSEO call. Defaults ' +
          'to false; the category counts themselves are free.',
      ),
  },
  check_website_nap: {
    business: business
      .optional()
      .describe(
        'The business whose profile the site is checked against: {mapsUrl}, {placeId}, {cid} ' +
          'or {name, city}. Needs the extension. Give business, or profile with url.',
      ),
    url: z
      .string()
      .url()
      .optional()
      .describe(
        'The page to check, an absolute http or https URL, usually the location page. ' +
          'Defaults to the website the profile links. Required when business is not given.',
      ),
    profile: z
      .object({
        name: z.string().min(1).describe('The business name as the profile shows it.'),
        phone: z
          .string()
          .optional()
          .describe('The profile phone in any format, such as "+1 845-555-0100".'),
        address: z
          .string()
          .optional()
          .describe('The profile address on one line, such as "250 W Nyack Rd, West Nyack, NY".'),
      })
      .optional()
      .describe(
        'The profile facts to compare, when you have them already. Overrides what the extension ' +
          'reads. With url, this works without the extension. A field left out is not compared.',
      ),
  },
  compare_businesses: {
    businesses: z
      .array(business)
      .min(LIMITS.compare.min)
      .max(LIMITS.compare.max)
      .describe(
        `${LIMITS.compare.min} to ${LIMITS.compare.max} businesses, each {mapsUrl}, {placeId}, ` +
          '{cid} or {name, city}. The first is the one the gap is measured for.',
      ),
    keyword: z
      .string()
      .min(1)
      .optional()
      .describe(
        "A search to rank them all for, from the first business's location, such as " +
          '"emergency plumber". Defaults to none, which leaves ranks null.',
      ),
  },
  profile_history: { business },
  local_ai_visibility: {
    query: z
      .string()
      .min(1)
      .describe('What the customer wants, such as "emergency plumber" or "vegan bakery".'),
    city: z.string().min(1).describe('The town or city, such as "West Nyack, NY".'),
    businessName: z
      .string()
      .min(1)
      .describe('The business to look for in each answer, as people say its name.'),
    competitors: z
      .array(z.string().min(1))
      .max(10)
      .optional()
      .describe('Up to 10 competitor names to look for as well. Defaults to none.'),
    engines: z
      .array(z.enum(['chatgpt', 'gemini', 'perplexity', 'ai_mode']))
      .min(1)
      .optional()
      .describe(
        'The assistants to ask: chatgpt, gemini, perplexity, ai_mode (Google AI Mode). ' +
          'Defaults to all four.',
      ),
    source: z
      .enum(['assist', 'cloro'])
      .optional()
      .describe(
        "assist (the default) opens each assistant in the user's own signed-in browser tabs " +
          'for free; the user may need to press Enter. cloro asks chatgpt, gemini and ai_mode ' +
          "unattended through the user's Cloro key, paid within the monthly cap set in the " +
          'extension; perplexity is always asked in assist mode.',
      ),
    estimateOnly: z
      .boolean()
      .optional()
      .describe(
        'Return only estimatedCostUsd and ask nothing, so the user can approve a cloro run ' +
          'first. Defaults to false.',
      ),
  },
} as const satisfies Readonly<Record<ToolName, z.ZodRawShape>>

// Compile-time guard: each schema, once JSON drops its undefined members, is the protocol's
// argument type, so a protocol change that is not mirrored here fails the typecheck.
type Parsed<T extends ToolName> = z.infer<z.ZodObject<(typeof SHAPES)[T]>>
type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> }
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T
export type ShapesMatchProtocol = Assert<
  { [T in ToolName]: Same<Defined<Parsed<T>>, ToolArgs[T]> }[ToolName]
>
