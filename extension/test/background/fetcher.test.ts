// The website check's fetch, with fetch stubbed: no site is reached.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { extensionFetcher } from '../../src/background/fetcher'

afterEach(() => vi.unstubAllGlobals())

describe("fetching a business's website", () => {
  it('given a page of normal size, then its text comes back', async () => {
    vi.stubGlobal('fetch', async () => new Response('<h1>Nyack Plumbing</h1>', { status: 200 }))
    const page = await extensionFetcher.fetch({ url: 'https://www.nyackplumbing.com/' })
    expect(page).toMatchObject({ status: 200, body: '<h1>Nyack Plumbing</h1>' })
  })

  it('given a body over 5 MB with no length header, then it is refused', async () => {
    const chunk = new Uint8Array(1024 * 1024)
    let sent = 0
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1
        controller.enqueue(chunk)
      },
    })
    vi.stubGlobal('fetch', async () => new Response(endless, { status: 200 }))
    await expect(extensionFetcher.fetch({ url: 'https://www.nyackplumbing.com/' })).rejects.toThrow(
      'https://www.nyackplumbing.com/ sent more than 5 MB.',
    )
    expect(sent).toBeLessThan(10)
  })
})
