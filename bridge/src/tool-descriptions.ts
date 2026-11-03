// The words an agent reads before it calls a tool. Agents never see output schemas, so each
// description also says what comes back and what an absent or null value means.
import { LIMITS } from '@local-seo/core/bridge'
import type { ToolName } from '@local-seo/core/bridge'

const MISSING =
  'A profile field the page or provider did not give is {missing: true, reason}; with ' +
  'absent: true it means Google was read and lists nothing there (no phone on the profile), ' +
  'which is a real gap, while without it the value is simply unknown. Never treat either as 0.'

const PAID =
  "With source dataforseo it spends from the user's own DataForSEO account inside the " +
  'extension, within the monthly cap set there; a call over the cap, or with no cap set, is ' +
  'refused with an error saying so, and the same request within the cache window the user set ' +
  'in the extension (7 days unless changed) is served from the cache for nothing. spend says ' +
  'what was charged (null when nothing paid was called). The agent never sees the key.'

const BROWSER =
  "It works in the user's own Chrome through the Local SEO extension, opening Google Maps in a " +
  'background tab, and fails with a message saying how to connect when the extension is not ' +
  'connected. Nothing is written to Google.'

const FINDINGS =
  'Each finding has checkId (a Local SEO check id such as L7), group, status (pass, partial, ' +
  'fail or not_applicable), severity (high, medium or low on a fail or partial, null ' +
  'otherwise), a one-sentence summary and evidence (url, value, note). not_applicable means ' +
  'the check could not be judged, never that it passed or failed.'

const BUSINESS_SUMMARY =
  'business (name, source, readAt, placeId, cid, primaryCategory, address, phone, website, ' +
  'rating, reviewCount; each null when unknown)'

const RANKED =
  'Each result has position (1-based, ads not counted), sponsored, name, ids (placeId, cid, ' +
  'kgId, featureId, each null when Maps did not expose it), primaryCategory, rating, ' +
  'reviewCount, address and location (the place pin {lat, lng}), each null when the list did ' +
  'not show it.'

const RANK =
  'A rank is {kind: "ranked", rank}, {kind: "not_found", depth} (the list was read to depth ' +
  'organic results, as many as Maps listed up to the cap, and the business was not there, ' +
  'which is not rank 0), or {kind: "unknown", reason} (the point could not be read, or Maps ' +
  'cut its list short, so the business may sit just past it).'

export const TOOL_TITLES: Readonly<Record<ToolName, string>> = {
  find_business: 'Find a business',
  audit_profile: 'Audit a Business Profile',
  read_reviews: 'Read reviews',
  read_posts: 'Read posts',
  local_scan: 'Scan local results',
  rank_at: 'Rank from a point',
  geo_grid: 'Geo-grid rank map',
  category_ideas: 'Category ideas',
  check_website_nap: 'Check website NAP',
  compare_businesses: 'Compare businesses',
  profile_history: 'Profile history',
  local_ai_visibility: 'Local AI visibility',
}

export const TOOL_DESCRIPTIONS: Readonly<Record<ToolName, string>> = {
  find_business:
    'Searches Google Maps for a business by name, or for a kind of business, and lists the ' +
    'places Maps shows. Use it first when the user names a business, to get an exact placeId ' +
    'or cid to pass as business to the other tools; if several candidates fit, ask the user ' +
    `which one. ${BROWSER} Returns query, from (the point searched from, null when Maps chose) ` +
    `and candidates. ${RANKED}`,
  audit_profile:
    'Audits one Google Business Profile against every Local SEO check: profile basics, ' +
    'categories, description, services and attributes, photos, reviews, posts, the linked ' +
    'website and trust signals, with a 0-100 score. Use it for a profile audit or to confirm a ' +
    'fix. include picks what is read beyond the profile; keyword adds the relevance checks and ' +
    `is the competitor search. ${BROWSER} It can take a few minutes. Returns business (the ` +
    'full profile record), findings, score (an object: score, 0-100, or null when no check ' +
    'could be judged; judged, the number of checks judged; untested, the number ' +
    'not_applicable), fixes (checkId, title, severity, fix; most important first), ' +
    'reportMarkdown (the whole audit as a readable report) and notes on what was not read, ' +
    'including when Maps showed the page in a language other than English, which leaves ' +
    'some fields missing. ' +
    'The audit reads posts in the browser, which sees only the newest one, so the posting ' +
    'checks (L26 to L29) are not_applicable with the reason; read_posts with source dataforseo ' +
    'reads them all. When Maps keeps its own "Most relevant" review order, a note says so ' +
    'and the recency checks (L22 recent reviews, L24 reply speed, L25 recent unanswered ' +
    `negatives unless one was found) are not_applicable. ${FINDINGS} ${MISSING}`,
  read_reviews:
    "Reads a business's Google reviews and analyses them. Use it for review " +
    'strategy, reply drafting or to judge review velocity. source picks free browser reading ' +
    `or paid DataForSEO, which is faster for large reads: about $0.0015 per 10 reviews. ${PAID} ` +
    `Returns ${BUSINESS_SUMMARY}; reviews, one page of at most ${LIMITS.reviews.page} (id, ` +
    'rating, text, publishedAt ISO or null, relativeAge as shown, ownerReply or null, ' +
    'authorReviewCount, photoCount); analytics over every review read (count, averageRating, ' +
    'distribution by star, monthly trend, velocity in the last 30, 90 and 365 days or null ' +
    'when no review is dated, responses with reply rate and median reply days, ' +
    'unansweredNegatives, photoShare and themes); read (how many were read); order (newest: ' +
    "newest first; most_relevant: the browser could not set Maps' Newest sort, so the " +
    'reviews are Maps\' "Most relevant" sample, which can skip recent ones; do not judge ' +
    'velocity, reply speed or recent negatives from it); truncated (true when the read holds ' +
    'fewer than the profile has, or stopped at max when the profile count is unknown); notes ' +
    "(why fewer were read or why the order is not newest, such as Google's signed-out view " +
    "showing about five, only the Overview's reviews when the Reviews tab did not open, or " +
    'Maps shown in a language other than English, which can leave the order unset; ' +
    'empty when nothing to say); and nextCursor: when not null, ' +
    'call again with it as cursor for the next page of the same read. A null rate or average ' +
    'means there were no reviews to compute it from.',
  read_posts:
    "Reads a business's Google posts (Updates, offers and events), newest first, and analyses " +
    'how often the owner posts. Use it to judge posting cadence or before planning posts. ' +
    'source picks free browser reading, which sees only the newest post Maps shows on the ' +
    "profile's Overview, or paid DataForSEO, which reads the full list: about $0.003 per read " +
    `plus $0.0015 per 10 posts. ${PAID} Returns ${BUSINESS_SUMMARY}; posts (text, publishedAt ` +
    'or null, relativeAge, hasMedia, link, kind: update, offer, event or unknown); analytics ' +
    '(count, lastPostAgeDays, last30, last90, medianIntervalDays, gaps of over 30 days, ' +
    'mediaShare, linkShare, kinds; a null figure means no dated post supports it); truncated ' +
    '(always true from the browser); and unknown. unknown is null only when the full list was ' +
    'read (source dataforseo), and then an empty list is a real finding: the profile has no ' +
    'posts. From the browser unknown is always a sentence saying why (only the newest post ' +
    "was seen, or Google's signed-out view hid them): how often the business posts is unknown, " +
    'not zero; say so, and offer source dataforseo.',
  local_scan:
    'Reads the Google Maps results for a search from a point and lays them out side by side, ' +
    'with how often each category is used. Use it to see who wins a local search and why, or ' +
    'to find competitors. withDetails opens each profile for the fields the result list does ' +
    `not show. ${BROWSER} Returns results (surface, query, from, readAt and the ranked list), ` +
    'rows (position, sponsored, name, ids, primaryCategory, secondaryCategories, rating, ' +
    'reviewCount, photoCount, website, phone, claimed, address, distanceKm from the point ' +
    'searched from, straight line to one decimal; each null when not read or not known), ' +
    'categoryFrequency (category, usedBy, asPrimary, share 0-1 of rows with known categories), ' +
    'detailsRead and truncated (stopped at max while Maps had more). ' +
    `${RANKED}`,
  rank_at:
    'Runs one Maps search as if the customer stood at a point (Teleport) and says where the ' +
    'business ranks there. Use it to check one location, such as a customer complaint ' +
    `("I can't find you from the station"); use geo_grid for an area. ${BROWSER} Returns at, ` +
    `zoom, rank and results, the top ${LIMITS.rankDepth} at that point. ${RANK} ${RANKED}`,
  geo_grid:
    'Maps where a business ranks across an area: a size x size grid of points spacingKm apart ' +
    'around center, one Maps search from each. Use it for rank diagnosis by distance. The ' +
    `browser source is free but slow and capped at ${LIMITS.grid.browserMaxSize}x` +
    `${LIMITS.grid.browserMaxSize}; dataforseo allows up to ${LIMITS.grid.maxSize}x` +
    `${LIMITS.grid.maxSize} at $0.002 per point (a 7x7 grid is about $0.10). Call it first ` +
    'with estimateOnly true to get the price for the user to approve. ' +
    `${PAID} A large browser grid can take 10 minutes. Returns source, depth (results read at ` +
    'each point), cells (point with row, col, lat, lng; and rank), summary (points, ranked, ' +
    'notFound, unknown, averageRank over ranked points or null, top3Share of read points or ' +
    'null, best), estimatedCostUsd (null for browser) and spend. With estimateOnly, cells is ' +
    `empty and summary null. ${RANK}`,
  category_ideas:
    'Finds the Google Business Profile categories that the top-ranking competitors use, how ' +
    'often, and which of them the business lacks. Use it to choose a primary category and ' +
    'secondary categories. Give business, query or both: with only a business, its primary ' +
    "category is the search. The top 8 competitors' profiles are opened one at a time in a " +
    `background tab for their secondary categories, so it takes about a minute. ${BROWSER} ` +
    'The category counts are read from Maps for free; searchVolumes ' +
    'adds paid DataForSEO search volumes for each category name (one keyword task, about ' +
    `$0.012 plus $0.00012 per category). ${PAID} Returns query, competitorsRead, categories ` +
    '(category, usedBy, asPrimary, share 0-1), missing (null when no business was given), ' +
    "volumes (category, monthlySearches or null when unknown, in the business's country, or " +
    'the United States when its address names no country or no business was given; volumes ' +
    'itself is null unless searchVolumes was asked for and a key is set) and spend.',
  check_website_nap:
    "Checks whether a business's website states the same name, address, phone and hours as " +
    'its Google profile, and whether it has LocalBusiness schema, a click-to-call link and an ' +
    'embedded map. Use it for NAP consistency or to check a location page. With business, the ' +
    'extension reads the profile from Maps and checks the website it links unless url is ' +
    'given. Without the extension, pass url and profile (name, and phone and address if ' +
    'known) and the page is fetched from this computer instead, without running its ' +
    'JavaScript. Returns website (url; name, address, phone and hours each with status match, ' +
    'mismatch, not_found (the site does not state it) or profile_missing (nothing to compare), ' +
    'the profile value and what the site states; localSchema with types and missing fields, ' +
    'or null when the page has no LocalBusiness schema; telLinks; embeddedMap), findings ' +
    `(checks L30 to L35), profileFrom (maps or arguments) and notes. ${FINDINGS}`,
  compare_businesses:
    'Lays 2 to 10 Google Business Profiles side by side and measures how far the first falls ' +
    'behind the rest. Use it when the user names their competitors; use local_scan to find ' +
    `who actually ranks. keyword adds each business's Maps rank. ${BROWSER} Returns rows in ` +
    'the order given (position is that order; name, ids, categories, rating, reviewCount, ' +
    'photoCount, website, phone, claimed, address; each null when unknown), gap (competitors, ' +
    'missingCategories, primarySharedBy, and reviews, rating and photos each as target, ' +
    'competitorMedian, difference and known, null where a side is unknown; and summary ' +
    `sentences) and ranks (null without keyword). ${RANK}`,
  profile_history:
    'Lists what the extension saved each time it read this profile in the past, and what ' +
    'changed between reads: name, categories, address, phone, website, hours, description, ' +
    'rating, review and photo counts, claimed state and closure. Use it to spot a suspended or ' +
    'edited profile, or a competitor changing its name or category. History comes from the ' +
    'extension storage, so a profile never read before has none. An id or link this device ' +
    'has seen answers without reading Google; given {name, city}, a short link, or an id the ' +
    "extension has not seen, Maps is opened once to learn the business's ids first. Returns " +
    `snapshots (readAt and a summary, oldest first) and changes (field, before, after, from, ` +
    `to). ${MISSING}`,
  local_ai_visibility:
    'Asks AI assistants a local buyer question, "best <query> in <city>", and reads whether ' +
    'each answer names the business. Use it to measure local AI visibility against ' +
    "competitors. source assist (the default, free) asks in the user's own signed-in browser " +
    'sessions, and an engine the user is not signed in to comes back missing. source cloro ' +
    "asks ChatGPT, Gemini and AI Mode unattended through the user's Cloro key: about $0.014 " +
    'for chatgpt and $0.012 each for gemini and ai_mode; call it first with estimateOnly ' +
    'true to get the price for the user to approve. A cloro run over the monthly cap, or with ' +
    'no key or cap set, is refused with an error saying so. Perplexity is always asked in ' +
    `assist mode. ${BROWSER} Returns prompt, source, estimatedCostUsd (null for assist) and ` +
    'answers (empty with estimateOnly), one per engine: engine, and answer, either {missing: ' +
    'true, reason} or verdict (recommended when among the first three businesses named, ' +
    'named when later, absent), ' +
    'position (1-based among businesses named, null when absent), excerpt (the passage naming ' +
    'it, or the opening when absent), businessesNamed, competitorsNamed and citedUrls. One run ' +
    'is one sample; answers change between runs.',
}
