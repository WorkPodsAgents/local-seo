// The page-world hook that keeps Maps' place data, on a fake page: Maps' requests go through a
// fake fetch and XMLHttpRequest that answer with the saved place response.
import { describe, expect, it } from 'vitest'
import { installPlaceHook, placeBodyFor, type PageWindow } from '../../src/readers/maps/place-hook'
import { savedPlaceData } from './maps-fixture'

const ORIGIN = 'https://www.google.com'
const FEATURE_ID = '0x865b4b5e859f967f:0x38deff12e0bdefcb'

class FakeRequest extends EventTarget {
  responseType: XMLHttpRequestResponseType = ''
  responseText = ''
  status = 0
  url = ''
  open(_method: string, url: string): void {
    this.url = url
  }
  /** Answers as the server would, firing `load` like a browser. */
  answer(body: string): void {
    this.status = 200
    this.responseText = body
    this.dispatchEvent(new Event('load'))
  }
}

class FakePage extends EventTarget {
  readonly location = { href: `${ORIGIN}/maps/place/South+Austin+Dentist`, origin: ORIGIN }
  readonly XMLHttpRequest = class extends FakeRequest {}
  readonly fetched: string[] = []
  fetch: typeof fetch = async (input) => {
    this.fetched.push(String(input))
    return new Response(savedPlaceData().body)
  }
  postMessage(message: unknown, targetOrigin: string): void {
    expect(targetOrigin).toBe(ORIGIN)
    setTimeout(() => {
      this.dispatchEvent(new MessageEvent('message', { data: message, origin: ORIGIN }))
    })
  }
  override dispatchEvent(event: Event): boolean {
    // Messages a page posts to itself come from itself.
    if (event instanceof MessageEvent) Object.defineProperty(event, 'source', { value: this })
    return super.dispatchEvent(event)
  }
}

function hookedPage(): PageWindow & FakePage {
  const page = new FakePage() as FakePage & PageWindow
  installPlaceHook(page)
  return page
}

function placeUrl(featureId: string): string {
  return `/maps/preview/place?authuser=0&hl=en&pb=!1m16!1s${encodeURIComponent(featureId)}!3m8`
}

describe('keeping the place data Maps fetches', () => {
  it('keeps a place response sent with fetch and leaves it unread for Maps', async () => {
    const page = hookedPage()
    const response = await page.fetch(placeUrl(FEATURE_ID))
    expect(await response.text()).toBe(savedPlaceData().body)
    await expect(placeBodyFor(page, FEATURE_ID)).resolves.toBe(savedPlaceData().body)
  })

  it('keeps a place response sent with XMLHttpRequest, unchanged', async () => {
    const page = hookedPage()
    const request = new page.XMLHttpRequest()
    request.open('GET', placeUrl(FEATURE_ID))
    request.answer(savedPlaceData().body)
    expect(request.responseText).toBe(savedPlaceData().body)
    await expect(placeBodyFor(page, FEATURE_ID)).resolves.toBe(savedPlaceData().body)
  })

  it('observes no other address', async () => {
    const page = hookedPage()
    const search = `/search?tbm=map&pb=!1m16!1s${encodeURIComponent(FEATURE_ID)}`
    await (await page.fetch(search)).text()
    const request = new page.XMLHttpRequest()
    request.open('GET', `https://evil.example/maps/preview/place?pb=!1s${FEATURE_ID}`)
    request.answer(savedPlaceData().body)
    await expect(placeBodyFor(page, FEATURE_ID)).resolves.toBeNull()
  })

  it('keeps only the last 20 places', async () => {
    const page = hookedPage()
    const ids = Array.from({ length: 21 }, (_, n) => `0x${n.toString(16)}:0x1`)
    for (const id of ids) await (await page.fetch(placeUrl(id))).text()
    await expect(placeBodyFor(page, ids[0] as string)).resolves.toBeNull()
    await expect(placeBodyFor(page, ids[20] as string)).resolves.toBe(savedPlaceData().body)
  })

  it('answers null when no hook runs in the page', async () => {
    const page = new FakePage() as FakePage & PageWindow
    await expect(placeBodyFor(page, FEATURE_ID, 20)).resolves.toBeNull()
  })
})
