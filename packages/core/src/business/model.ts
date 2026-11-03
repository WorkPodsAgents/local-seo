// A Google Business Profile as every reader, provider client, check and tool shares it. The
// browser readers and DataForSEO both fill this one shape, so a check never knows which source
// it came from. A field the source did not show is a `Missing` with the reason, never 0 or ''.

/** A value the source did not provide, and why, so an audit can say "unknown" honestly. */
export interface Missing {
  readonly missing: true
  readonly reason: string
  /**
   * The source was read and shows no such value (a profile with no phone listed), as opposed to
   * the source not being able to say. Only an absent value may fail a completeness check.
   */
  readonly absent?: true
}

export type Known<T> = T | Missing

export function missing(reason: string): Missing {
  return { missing: true, reason }
}

/** The source was read and lists nothing here. */
export function absent(reason: string): Missing {
  return { missing: true, reason, absent: true }
}

export function isMissing<T>(value: Known<T>): value is Missing {
  return typeof value === 'object' && value !== null && 'missing' in value
}

/** Where a business record came from; the panel and the tools say this next to every number. */
export type BusinessSource = 'maps_page' | 'search_panel' | 'dataforseo'

/** The identifiers Google gives one place. Each is null when that source does not expose it. */
export interface BusinessIds {
  /** Places API id, such as ChIJ... */
  readonly placeId: string | null
  /** Customer id, decimal string, used in maps.google.com/?cid= links. */
  readonly cid: string | null
  /** Knowledge Graph id, such as /g/11c... */
  readonly kgId: string | null
  /** The hex feature id Maps puts in its URLs, such as 0x89c2...:0x5b1... */
  readonly featureId: string | null
}

export interface Address {
  /** The single line Google shows. */
  readonly formatted: string
  readonly street: string | null
  readonly city: string | null
  readonly region: string | null
  readonly postalCode: string | null
  /** ISO 3166-1 alpha-2. */
  readonly country: string | null
}

export interface LatLng {
  readonly lat: number
  readonly lng: number
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

/** One opening interval in the business's local time, 24-hour "HH:MM". */
export interface OpenInterval {
  readonly day: Weekday
  readonly opens: string
  readonly closes: string
}

/** Hours as shown; `closedAllWeek` and an empty list differ from hours not being listed. */
export interface Hours {
  readonly intervals: readonly OpenInterval[]
  readonly open24h: readonly Weekday[]
}

/** An attribute group and its values as Google lists them, such as "Accessibility". */
export interface AttributeGroup {
  readonly group: string
  readonly values: readonly string[]
}

export interface Review {
  readonly id: string | null
  readonly rating: number
  readonly text: string | null
  /** ISO date, or null when only a relative age ("3 weeks ago") was shown. */
  readonly publishedAt: string | null
  /** The age as Google showed it, kept so a relative date can be resolved later. */
  readonly relativeAge: string | null
  readonly ownerReply: { readonly text: string; readonly publishedAt: string | null } | null
  readonly authorReviewCount: number | null
  readonly photoCount: number
}

export interface Post {
  readonly text: string
  readonly publishedAt: string | null
  readonly relativeAge: string | null
  readonly hasMedia: boolean
  /** The call-to-action link, when the post has one. */
  readonly link: string | null
  readonly kind: 'update' | 'offer' | 'event' | 'unknown'
}

export interface Business {
  readonly source: BusinessSource
  /** When this record was read, ISO. */
  readonly readAt: string
  readonly ids: BusinessIds
  readonly name: string
  readonly categories: {
    readonly primary: Known<string>
    readonly secondary: Known<readonly string[]>
  }
  readonly address: Known<Address>
  /** Service-area businesses hide their street address and list areas instead. */
  readonly serviceAreas: Known<readonly string[]>
  readonly location: Known<LatLng>
  readonly phone: Known<string>
  readonly website: Known<string>
  readonly hours: Known<Hours>
  readonly attributes: Known<readonly AttributeGroup[]>
  readonly services: Known<readonly string[]>
  readonly products: Known<readonly string[]>
  readonly description: Known<string>
  readonly rating: Known<number>
  readonly reviewCount: Known<number>
  readonly photoCount: Known<number>
  /** Whether the owner has claimed the profile ("Own this business?" shown means false). */
  readonly claimed: Known<boolean>
  /** Permanently or temporarily closed, as Google labels it; null when open. */
  readonly closure: 'permanent' | 'temporary' | null
}

/** One business in a ranked list: Maps results, the 3-pack or the Local Finder. */
export interface RankedBusiness {
  /** 1-based, ads excluded. */
  readonly position: number
  readonly sponsored: boolean
  readonly name: string
  readonly ids: BusinessIds
  readonly primaryCategory: string | null
  readonly rating: number | null
  readonly reviewCount: number | null
  readonly address: string | null
  /** The place's own pin, which gives each result its distance; null when the list hid it. */
  readonly location: LatLng | null
}

/** Where a local result list was read, and for which query. */
export interface LocalResults {
  readonly surface: 'maps' | 'local_pack' | 'local_finder'
  readonly query: string
  /** The point the search was run from, when known (Teleport and grids set it). */
  readonly from: LatLng | null
  readonly readAt: string
  readonly results: readonly RankedBusiness[]
}
