// The one file that wires the Local SEO services to Chrome: the scratch Maps tab, IndexedDB and
// session storage, the paid providers with the user's keys, the offscreen website check, and the
// assistants. It registers the bridge's twelve tools and the panel's messages on the router.
import { LIMITS } from '@local-seo/core/bridge'
import type { Business } from '@local-seo/core/business'
import { createLocalDataForSeo } from '@local-seo/core/providers/dataforseo-local'
import { draftPrompt, fitDraft, servicesOf } from '@local-seo/core/writers'
import {
  createCloro,
  createDataForSeo,
  type KeyValueStore,
  type Provider,
  type ResponseCache,
} from '@open-agent-ready/core/providers'
import { assistInTab } from '../answers/assist-tab'
import { localAiVisibility, type AnswerDeps } from '../answers/visibility'
import { openBusiness } from '../maps/resolve'
import { withMapsPage } from '../maps/scratch-tab'
import { languageNote } from '../readers/maps/language'
import { askTab } from '../readers/tab-client'
import { capVerdict, formatUsd, PROVIDER_LABEL } from '../shared/cost'
import { emit } from '../shared/events'
import type { BusinessView, ScanView } from '../shared/local'
import { auditBusiness } from '../services/audit'
import { pageLanguageNote } from '../services/reads'
import type { LocalDeps } from '../services/deps'
import { MODEL_ID, MODEL_LABEL, MODEL_SECRET, writeText } from '../services/models'
import { createReviewPages } from '../services/review-pages'
import { createSnapshotStore } from '../services/snapshots'
import { createLocalTools, type LocalTools } from '../services/tools'
import { categoryFrequency, scanTable } from '@local-seo/core/compare'
import { handle } from './handle'
import { requireHostAccess } from './host-access'
import { idbDelete, idbGet, idbSet } from './idb'
import { offscreen } from './offscreen'
import { dataForSeoCredentials, ledger, paid, responseCache, taskIds } from './paid'
import { registerTools } from './tools'
import { vault } from './vault'

const clock = () => Date.now()
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
/** Between two browser grid searches, so a 5x5 grid reads like a person panning the map. */
const GRID_PAUSE_MS = 4_000
const LAST_AUDIT = 'audit:last'

const resultsStore: KeyValueStore = {
  get: (key) => idbGet('results', key),
  set: (key, value) => idbSet('results', key, value),
  remove: (key) => idbDelete('results', key),
}

// Memory only and cleared when the browser closes; it outlives a sleeping service worker.
const sessionStore: KeyValueStore = {
  async get(key) {
    return (await browser.storage.session.get(key))[key]
  },
  set: (key, value) => browser.storage.session.set({ [key]: value }),
  remove: (key) => browser.storage.session.remove(key),
}

const providerDeps = { ledger, cache: responseCache, credentials: dataForSeoCredentials, clock }
const dataForSeo = createLocalDataForSeo({ ...providerDeps, sleep, taskIds })
const labs = createDataForSeo(providerDeps)
/** An AI answer is one sample of what the assistant says now; a stored one is not a new run. */
const noReuse: ResponseCache = { get: async () => undefined, put: async () => undefined }
const cloro = createCloro({
  ledger,
  cache: noReuse,
  apiKey: () => vault.get('cloro_key'),
  clock,
})

let gridStop = false

async function paidBlock(provider: Provider, usd: number): Promise<string | null> {
  const name = PROVIDER_LABEL[provider]
  if (!(await vault.isUnlocked())) return 'Unlock the vault in Settings to use your provider keys.'
  const keys =
    provider === 'dataforseo' ? await dataForSeoCredentials() : await vault.get('cloro_key')
  if (keys === null) return `Add your ${name} credentials in Settings first.`
  const verdict = capVerdict(usd, (await ledger.summary()).providers[provider])
  if (verdict.kind === 'no_cap') return `Set a monthly ${name} cap in Settings first.`
  if (verdict.kind === 'over') {
    const left = formatUsd(verdict.remainingUsd)
    return `This costs about ${formatUsd(usd)}; ${left} is left of this month's ${name} cap.`
  }
  return null
}

const assistOnly: AnswerDeps = {
  assist: async (engine, prompt, focus) => {
    const read = await assistInTab(engine, prompt, focus)
    if (read.kind === 'missing') return read
    const citedUrls = read.answer.citations.map((citation) => citation.url)
    return { kind: 'answer', answer: { text: read.answer.text, citedUrls } }
  },
  cloro: null,
}

const withCloro: AnswerDeps = {
  ...assistOnly,
  cloro: async (engine, prompt) => {
    const answer = await paid(() => cloro.ask({ engine, prompt }))
    const citedUrls = answer.data.citations.map((citation) => citation.url)
    return { kind: 'answer', answer: { text: answer.data.text, citedUrls } }
  },
}

export const localDeps: LocalDeps = {
  maps: withMapsPage,
  snapshots: createSnapshotStore(resultsStore),
  reviewPages: createReviewPages(sessionStore, clock, () => crypto.randomUUID()),
  dataForSeo,
  keywordVolumes: (names, country) => labs.keywordMetrics(names, { location: country }),
  hasDataForSeo: async () => (await vault.isUnlocked()) && (await dataForSeoCredentials()) !== null,
  paidBlock,
  paid,
  website: async (business, url) => {
    await requireHostAccess(url)
    return offscreen('website', { business, url })
  },
  // The tool checks the Cloro key and cap first (paidBlock), so Cloro is only reached with both.
  answers: async (source) => (source === 'cloro' ? withCloro : assistOnly),
  now: () => new Date(),
  sleep,
  gridPauseMs: GRID_PAUSE_MS,
  gridStopped: () => gridStop,
  onGridProgress: (progress) => emit('grid:progress', progress),
}

export function registerLocalHandlers(): void {
  const tools = createLocalTools(localDeps)
  registerTools(tools, (name) => {
    if (name === 'geo_grid') gridStop = false
  })
  registerPanel(tools)
}

function registerPanel(tools: LocalTools): void {
  handle('local:find_business', tools.find_business)
  handle('local:audit_profile', tools.audit_profile)
  handle('local:read_reviews', (args) => tools.read_reviews({ ...args, source: 'browser' }))
  handle('local:read_posts', (args) => tools.read_posts({ ...args, source: 'browser' }))
  handle('local:local_scan', tools.local_scan)
  handle('local:rank_at', tools.rank_at)
  handle('local:geo_grid', (args) => {
    gridStop = false
    return tools.geo_grid({ ...args, source: 'browser' })
  })
  handle('local:category_ideas', (args) => tools.category_ideas({ ...args, searchVolumes: false }))
  handle('local:check_website_nap', tools.check_website_nap)
  handle('local:compare_businesses', tools.compare_businesses)
  handle('local:profile_history', tools.profile_history)

  handle('paid:geo_grid', async (args) => {
    gridStop = false
    const data = await tools.geo_grid({ ...args, source: 'dataforseo' })
    return { data, costUsd: data.spend?.usd ?? 0, cached: data.spend?.cached ?? false }
  })
  handle('paid:read_reviews', async (args) => {
    const data = await tools.read_reviews({ ...args, source: 'dataforseo' })
    return { data, costUsd: data.spend?.usd ?? 0, cached: data.spend?.cached ?? false }
  })
  handle('paid:read_posts', async (args) => {
    const data = await tools.read_posts({ ...args, source: 'dataforseo' })
    return { data, costUsd: data.spend?.usd ?? 0, cached: data.spend?.cached ?? false }
  })
  handle('paid:category_volumes', async ({ categories, country }) => {
    const answer = await paid(() => labs.keywordMetrics(categories, { location: country }))
    const byName = new Map(answer.data.map((row) => [row.keyword.toLowerCase(), row.searchVolume]))
    const data = categories.map((category) => ({
      category,
      monthlySearches: byName.get(category.toLowerCase()) ?? null,
    }))
    return { data, costUsd: answer.costUsd, cached: answer.cached }
  })
  handle('paid:ai_answers', async (args) => {
    const spentBefore = (await ledger.summary()).providers.cloro.spentUsd
    // The tool checks the cap for every engine first, so a run never stops half paid for.
    const data = await tools.local_ai_visibility({ ...args, source: 'cloro' })
    const spentAfter = (await ledger.summary()).providers.cloro.spentUsd
    return { data, costUsd: Math.max(0, spentAfter - spentBefore), cached: false }
  })
  handle('answers:assist', (args) => localAiVisibility(args, assistOnly))

  handle('business:audit', async ({ tab, ref, include, keyword }) => {
    const { business, language } = await businessFor(tab, ref)
    const history = await localDeps.snapshots.save(business)
    const audit = await auditBusiness(localDeps, business, include, keyword, language)
    const view: BusinessView = { ...audit, history }
    await idbSet('results', LAST_AUDIT, view)
    return view
  })
  handle('business:last', async () => (await idbGet<BusinessView>('results', LAST_AUDIT)) ?? null)
  handle('scan:tab', async ({ tab, max }) => scanTab(tab, max))
  handle('overlay:set', async ({ tab, on }) =>
    on
      ? (await askTab(tab, 'overlay:show', {})).labelled
      : (await askTab(tab, 'overlay:hide', {})).removed,
  )
  handle('grid:stop', async () => {
    gridStop = true
    return null
  })
  handle('draft:write', async (request) => {
    // A locked vault reads as no key at all, which would send the user to add one again.
    if ((await vault.isSetUp()) && !(await vault.isUnlocked())) {
      throw new Error('Unlock the vault in Settings to write drafts with your model key.')
    }
    const prompt = draftPrompt(request)
    for (const [provider, secret] of MODEL_SECRET) {
      const key = await vault.get(secret).catch(() => null)
      if (key === null) continue
      const text = await writeText(provider, key, { ...prompt, maxTokens: 1200 }, fetch)
      const services = request.kind === 'services' ? servicesOf(text) : null
      return {
        text: services === null ? fitDraft(text, prompt.maxChars) : services.join('\n'),
        services,
        model: `${MODEL_LABEL[provider]} (${MODEL_ID[provider]})`,
      }
    }
    throw new Error('Add an Anthropic, OpenAI or Gemini key in Settings to write drafts.')
  })
}

async function businessFor(
  tab: { id: number; url: string } | null,
  ref: Parameters<LocalTools['audit_profile']>[0]['business'] | null,
): Promise<{ business: Business; language: string | null }> {
  if (tab !== null && new URL(tab.url).pathname.startsWith('/maps')) {
    const place = await askTab(tab, 'maps:readPlace', {})
    if (place !== null) {
      const { language } = await askTab(tab, 'maps:language', {})
      return { business: place, language: languageNote(language) }
    }
  }
  if (ref === null) throw new Error('Open a business in Google Maps first.')
  return withMapsPage(async (page) => ({
    business: await openBusiness(page, ref),
    language: await pageLanguageNote(page),
  }))
}

async function scanTab(tab: { id: number; url: string }, max: number): Promise<ScanView> {
  // The panel offers the same search in Maps on a results page; the pack readers are not written.
  if (!new URL(tab.url).pathname.startsWith('/maps')) {
    throw new Error('Local pack and Local Finder reading is coming; open the search in Maps.')
  }
  const read = await askTab(tab, 'maps:readResults', { max: Math.min(max, LIMITS.scan.max) })
  if (read === null) {
    throw new Error('This tab shows no list of places. Search Google Maps, then scan again.')
  }
  const rows = scanTable(read.results.results, [], read.results.from)
  return {
    results: read.results,
    rows,
    categoryFrequency: categoryFrequency(rows.filter((row) => !row.sponsored)),
    detailsRead: 0,
    truncated: read.stoppedBy === 'want',
    stoppedBy: read.stoppedBy,
  }
}
