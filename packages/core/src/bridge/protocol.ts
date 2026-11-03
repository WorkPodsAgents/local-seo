// The messages between the local bridge (an MCP server the user's agent starts) and the extension.
// The bridge listens on 127.0.0.1 and accepts a WebSocket only from this extension's origin; the
// extension connects out to it. Paid provider calls run inside the extension with the user's keys,
// so no credential ever crosses this link.
import type { LocalFinding, ProfileScore } from '../audit'
import type {
  Business,
  Known,
  LatLng,
  LocalResults,
  Post,
  RankedBusiness,
  Review,
} from '../business'
import type { CategoryUse, CompetitorGap, ScanRow } from '../compare'
import type { GridCell, GridSummary, PointRank } from '../geo'
import type { WebsiteCheck } from '../nap'
import type { PostAnalytics } from '../posts'
import type { BusinessSummary, Fix } from '../report'
import type { ReviewAnalytics } from '../reviews'

export const EXTENSION_ID = 'bljbmngieccnjdnlahdhgklcagfcphak'
export const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`
/** The port the bridge listens on; one above Agent Ready's, so both bridges can run at once. */
export const BRIDGE_PORT = 47822

/**
 * How the extension's error starts when the user has not granted it a site; the bridge then
 * checks the site in Node instead, where the agent gave it the page and the profile facts.
 */
export const NO_HOST_ACCESS = 'Local SEO has no access to'

/**
 * Which business a tool is about: a Maps link, one of Google's ids, or a name the extension
 * searches for in Maps. Ids are exact; a name can match the wrong place of the same name.
 */
export type BusinessRef =
  { mapsUrl: string } | { placeId: string } | { cid: string } | { name: string; city: string }

/** Where a search is seen from: a point, or a place name ("Leeds, UK") the extension looks up. */
export type Near = LatLng | string

/**
 * Browser reads what Maps shows the user and costs nothing; DataForSEO is paid from the user's
 * key inside the extension, within the monthly cap set there.
 */
export type Source = 'browser' | 'dataforseo'

export type AiEngine = 'chatgpt' | 'gemini' | 'perplexity' | 'ai_mode'

/**
 * Assist opens each assistant in the user's own signed-in tabs, free; Cloro asks ChatGPT, Gemini
 * and AI Mode unattended, paid from the user's Cloro key within the monthly cap.
 */
export type AiSource = 'assist' | 'cloro'

export type AuditPart = 'reviews' | 'posts' | 'website' | 'competitors'

/** Defaults and caps both ends share, so the bridge's schema and the extension cannot disagree. */
export const LIMITS = {
  reviews: { default: 50, max: 500, page: 100 },
  posts: { default: 30, max: 100 },
  scan: { default: 20, max: 120 },
  /** Maps shows 20 results before the list needs scrolling; a rank deeper is "not found". */
  rankDepth: 20,
  zoom: { default: 14, min: 3, max: 21 },
  grid: { minSize: 3, maxSize: 13, browserMaxSize: 5 },
  compare: { min: 2, max: 10 },
} as const

export const DEFAULT_AUDIT_PARTS: readonly AuditPart[] = ['reviews', 'posts', 'website']
export const ALL_AI_ENGINES: readonly AiEngine[] = ['chatgpt', 'gemini', 'perplexity', 'ai_mode']

/**
 * Profile facts an agent passes when no Maps read is possible (the Node fallback). The fields
 * admit undefined because the bridge's schema only drops undefined at the top level.
 */
export interface NapFacts {
  name: string
  phone?: string | undefined
  /** One line, as Google shows it: "250 W Nyack Rd #200, West Nyack, NY 10994". */
  address?: string | undefined
}

/**
 * Every tool the extension serves, with its arguments. The bridge's schemas, the extension's
 * handlers and the skill lint all read this one map, so a tool exists once it is added here.
 */
export interface ToolArgs {
  find_business: { query: string; near?: Near }
  audit_profile: { business: BusinessRef; keyword?: string; include?: AuditPart[] }
  read_reviews: { business: BusinessRef; max?: number; source?: Source; cursor?: string }
  read_posts: { business: BusinessRef; max?: number; source?: Source }
  local_scan: { query: string; near?: Near; max?: number; withDetails?: boolean }
  rank_at: { query: string; business: BusinessRef; at: LatLng; zoom?: number }
  geo_grid: {
    query: string
    business: BusinessRef
    center: LatLng
    size: number
    spacingKm: number
    source?: Source
    zoom?: number
    estimateOnly?: boolean
  }
  category_ideas: { business?: BusinessRef; query?: string; near?: Near; searchVolumes?: boolean }
  check_website_nap: { business?: BusinessRef; url?: string; profile?: NapFacts }
  compare_businesses: { businesses: BusinessRef[]; keyword?: string }
  profile_history: { business: BusinessRef }
  local_ai_visibility: {
    query: string
    city: string
    businessName: string
    competitors?: string[]
    engines?: AiEngine[]
    source?: AiSource
    estimateOnly?: boolean
  }
}

export type ToolName = keyof ToolArgs

/** What a paid read cost; a result's `spend` is null when no paid provider was called. */
export interface Spend {
  /** What DataForSEO reported charging, USD; 0 when the answer came from the 7-day cache. */
  readonly usd: number
  readonly cached: boolean
}

export interface FindBusinessResult {
  readonly query: string
  /** The point Maps searched from; null when Maps used its own view. */
  readonly from: LatLng | null
  readonly candidates: readonly RankedBusiness[]
}

export interface AuditProfileResult {
  readonly business: Business
  /** Registry order; a check whose input was not read is not_applicable, never a fail. */
  readonly findings: readonly LocalFinding[]
  readonly score: ProfileScore
  readonly fixes: readonly Fix[]
  readonly reportMarkdown: string
  /** What was not read and why (a website that did not load, no keyword for competitors). */
  readonly notes: readonly string[]
}

export interface ReadReviewsResult {
  readonly business: BusinessSummary
  /** This page of the reviews read, in `order`, at most LIMITS.reviews.page. */
  readonly reviews: readonly Review[]
  /** Over every review read, not only this page. */
  readonly analytics: ReviewAnalytics
  /** Reviews read in all. */
  readonly read: number
  /**
   * `newest`: newest first. `most_relevant`: Maps' default order, kept when its Newest sort
   * could not be set; a sample that can skip recent reviews.
   */
  readonly order: 'newest' | 'most_relevant'
  /**
   * The read stopped at `max` while the profile has more reviews; with the profile's count
   * unknown, whenever the read stopped at `max`.
   */
  readonly truncated: boolean
  /** Pass as `cursor` for the next page of the same read; null on the last page. */
  readonly nextCursor: string | null
  /** Why fewer reviews were read than the profile has (Google's signed-out view, say). */
  readonly notes: readonly string[]
  readonly spend: Spend | null
}

export interface ReadPostsResult {
  readonly business: BusinessSummary
  readonly posts: readonly Post[]
  readonly analytics: PostAnalytics
  readonly truncated: boolean
  /**
   * Why the posts are unknown, such as Google's signed-out view hiding them; null when they were
   * read. When set, an empty `posts` means unknown, never "no posts".
   */
  readonly unknown: string | null
  readonly spend: Spend | null
}

export interface LocalScanResult {
  readonly results: LocalResults
  /** One per result; a detail no page showed is null. */
  readonly rows: readonly ScanRow[]
  /** Over the organic rows whose categories are known. */
  readonly categoryFrequency: readonly CategoryUse[]
  /** Profiles opened for details; 0 without withDetails. */
  readonly detailsRead: number
  /** The list stopped at `max` while Maps had more results. */
  readonly truncated: boolean
}

export interface RankAtResult {
  readonly at: LatLng
  readonly zoom: number
  readonly rank: PointRank
  /** The results read at that point, up to LIMITS.rankDepth, ads marked sponsored. */
  readonly results: readonly RankedBusiness[]
}

export interface GeoGridResult {
  readonly source: Source
  /** Results read at each point; a business deeper is not_found. */
  readonly depth: number
  /** North row first; empty when estimateOnly. */
  readonly cells: readonly GridCell[]
  /** Null when estimateOnly. */
  readonly summary: GridSummary | null
  /** The DataForSEO list price for the whole grid; null for the browser source. */
  readonly estimatedCostUsd: number | null
  readonly spend: Spend | null
}

export interface CategoryVolume {
  readonly category: string
  /** Monthly Google searches for the category name in the market; null when unknown. */
  readonly monthlySearches: number | null
}

export interface CategoryIdeasResult {
  /** The search the competitors were read for. */
  readonly query: string
  readonly competitorsRead: number
  readonly categories: readonly CategoryUse[]
  /** Competitors' categories the business lacks; null when no business was given. */
  readonly missing: readonly CategoryUse[] | null
  /** Null unless searchVolumes was asked for and a DataForSEO key is set. */
  readonly volumes: readonly CategoryVolume[] | null
  readonly spend: Spend | null
}

export interface WebsiteNapResult {
  readonly website: WebsiteCheck
  /** The website checks (L30 to L35) judged on this page. */
  readonly findings: readonly LocalFinding[]
  /** Where the profile facts came from: a Maps read, or the agent's `profile` argument. */
  readonly profileFrom: 'maps' | 'arguments'
  readonly notes: readonly string[]
}

export interface CompareBusinessesResult {
  /** In the order given; `position` is that order, 1 the first business. */
  readonly rows: readonly ScanRow[]
  /** The first business against the rest. */
  readonly gap: CompetitorGap
  /** Each business's Maps rank for `keyword`, in row order; null without a keyword. */
  readonly ranks: readonly PointRank[] | null
}

export type ProfileField =
  | 'name'
  | 'primaryCategory'
  | 'secondaryCategories'
  | 'address'
  | 'phone'
  | 'website'
  | 'hours'
  | 'description'
  | 'rating'
  | 'reviewCount'
  | 'photoCount'
  | 'claimed'
  | 'closure'

export interface ProfileChange {
  readonly field: ProfileField
  /** ISO times of the two snapshots compared. */
  readonly before: string
  readonly after: string
  /** The values as text; a value the read could not give stays Missing. */
  readonly from: Known<string>
  readonly to: Known<string>
}

export interface ProfileHistoryResult {
  /** Oldest first. Empty when the extension has never read this profile. */
  readonly snapshots: readonly { readonly readAt: string; readonly summary: BusinessSummary }[]
  /** Between consecutive snapshots, oldest first. */
  readonly changes: readonly ProfileChange[]
}

export interface AiAnswerVisibility {
  /** recommended: among the first three businesses named; named: later; absent: not named. */
  readonly verdict: 'recommended' | 'named' | 'absent'
  /** 1-based among the businesses the answer names; null when absent. */
  readonly position: number | null
  /** The passage naming the business, or the answer's opening when it is absent. */
  readonly excerpt: string
  readonly businessesNamed: readonly string[]
  readonly competitorsNamed: readonly string[]
  readonly citedUrls: readonly string[]
}

export interface EngineAnswer {
  readonly engine: AiEngine
  /** Missing when the engine could not be read (signed out, a captcha, no answer). */
  readonly answer: Known<AiAnswerVisibility>
}

export interface LocalAiVisibilityResult {
  readonly prompt: string
  /** Empty when estimateOnly. */
  readonly answers: readonly EngineAnswer[]
  readonly source: AiSource
  /** Cloro's list price for the engines it serves, USD; null for assist. */
  readonly estimatedCostUsd: number | null
}

/** What each tool answers with, as JSON; agents learn these shapes from the tool descriptions. */
export interface ToolResults {
  find_business: FindBusinessResult
  audit_profile: AuditProfileResult
  read_reviews: ReadReviewsResult
  read_posts: ReadPostsResult
  local_scan: LocalScanResult
  rank_at: RankAtResult
  geo_grid: GeoGridResult
  category_ideas: CategoryIdeasResult
  check_website_nap: WebsiteNapResult
  compare_businesses: CompareBusinessesResult
  profile_history: ProfileHistoryResult
  local_ai_visibility: LocalAiVisibilityResult
}

// Compile-time guard: a tool added to one map and not the other fails the typecheck.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T
export type ResultsMatchArgs = Assert<Same<keyof ToolResults, ToolName>>

export interface BridgeRequest<T extends ToolName = ToolName> {
  readonly id: string
  readonly tool: T
  readonly args: ToolArgs[T]
}

export type BridgeResponse =
  | { readonly id: string; readonly ok: true; readonly result: unknown }
  | { readonly id: string; readonly ok: false; readonly error: string }
