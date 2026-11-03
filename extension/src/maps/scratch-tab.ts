// The background tab the services read Maps in, so an agent's or a grid's searches never take
// over the tab the user is looking at. One tab is shared and every user waits their turn, since
// two reads navigating it at once would read each other's page. It closes after a minute idle.
// Chrome stops an idle service worker within 30 seconds, taking any timer with it, so the idle
// close is an alarm, and the tab's id is kept in session storage for the worker that wakes next.
import { askTab } from '../readers/tab-client'
import { blockedReason, type MapsPage, type PageLoad } from './page'

const IDLE_ALARM = 'maps-scratch-tab-idle'
const IDLE_CLOSE_MINUTES = 1
const TAB_KEY = 'mapsScratchTab'
const LOAD_TIMEOUT_MS = 20_000

let tabId: number | null = null
let queue: Promise<unknown> = Promise.resolve()

/** Runs `work` with the scratch tab once every earlier user is done with it. */
export function withMapsPage<T>(work: (page: MapsPage) => Promise<T>): Promise<T> {
  return inTurn(async () => {
    await browser.alarms.clear(IDLE_ALARM)
    try {
      return await work(scratchPage)
    } finally {
      await browser.alarms.create(IDLE_ALARM, { delayInMinutes: IDLE_CLOSE_MINUTES })
    }
  })
}

/**
 * Closes the scratch tab when its idle alarm fires, and once as the worker starts: a tab left
 * recorded then belongs to a worker Chrome stopped, so nothing is reading in it any more. Both
 * wait their turn, so neither closes a tab a read has just opened.
 */
export function watchScratchTab(failed: (error: unknown) => void): void {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === IDLE_ALARM) inTurn(closeScratchTab).catch(failed)
  })
  inTurn(closeScratchTab).catch(failed)
}

function inTurn<T>(work: () => Promise<T>): Promise<T> {
  const turn = queue.then(work)
  queue = turn.catch(() => undefined)
  return turn
}

async function closeScratchTab(): Promise<void> {
  const stored = (await browser.storage.session.get(TAB_KEY))[TAB_KEY]
  const id = tabId ?? (typeof stored === 'number' ? stored : null)
  tabId = null
  await browser.storage.session.remove(TAB_KEY)
  if (id !== null) await browser.tabs.remove(id).catch(() => undefined)
}

const scratchPage: MapsPage = {
  async open(url) {
    // Listening starts before the navigation, so the load waited for is this one, never the
    // end of the last page's load or an earlier page still showing.
    const loads = watchLoads()
    try {
      const id = await tabFor(url)
      return await settle(id, loads)
    } finally {
      loads.stop()
    }
  },
  async currentUrl() {
    const tab = await browser.tabs.get(await existingTab())
    return tab.url ?? tab.pendingUrl ?? ''
  },
  async read(type, payload) {
    const id = await existingTab()
    const tab = await browser.tabs.get(id)
    return askTab({ id, url: tab.url ?? '' }, type, payload)
  },
  wait: sleep,
}

async function tabFor(url: string): Promise<number> {
  if (tabId !== null) {
    const updated = await browser.tabs.update(tabId, { url }).catch(() => null)
    if (updated?.id !== undefined) return updated.id
  }
  const created = await browser.tabs.create({ url, active: false })
  if (created.id === undefined) throw new Error('Chrome did not open a tab to read Maps in.')
  tabId = created.id
  await browser.storage.session.set({ [TAB_KEY]: created.id })
  return created.id
}

async function existingTab(): Promise<number> {
  if (tabId === null) throw new Error('No Maps page is open to read.')
  return tabId
}

interface Loads {
  /** True once tab `id` started and finished loading after the watch began; false on timeout. */
  readonly complete: (id: number, ms: number) => Promise<boolean>
  readonly stop: () => void
}

function watchLoads(): Loads {
  const started = new Set<number>()
  const finished = new Set<number>()
  let check: () => void = () => undefined
  const listener = (tabId: number, change: { status?: string }) => {
    if (change.status === 'loading') started.add(tabId)
    if (change.status === 'complete' && started.has(tabId)) finished.add(tabId)
    check()
  }
  browser.tabs.onUpdated.addListener(listener)
  return {
    stop: () => browser.tabs.onUpdated.removeListener(listener),
    complete: (id, ms) =>
      new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), ms)
        check = () => {
          if (!finished.has(id)) return
          clearTimeout(timer)
          resolve(true)
        }
        check()
      }),
  }
}

/** The page once this navigation finished loading; the services then wait for it to render. */
async function settle(id: number, loads: Loads): Promise<PageLoad> {
  const loaded = await loads.complete(id, LOAD_TIMEOUT_MS)
  const tab = await browser.tabs.get(id).catch(() => null)
  if (tab === null) throw new Error('The tab reading Maps was closed.')
  const url = tab.url ?? tab.pendingUrl ?? ''
  const blocked = blockedReason(url)
  if (blocked !== null || loaded) return { url, blocked }
  throw new Error('Google Maps did not finish loading in 20 seconds.')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
