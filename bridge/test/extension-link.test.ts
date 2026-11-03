import { readFileSync } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import {
  bridgeSide,
  EXTENSION_ORIGIN,
  extensionSide,
  newPairingSecret,
  pairingCode,
  pairingKey,
  PAIRING_REFUSED,
  secretFromCode,
} from '@local-seo/core/bridge'
import type { BridgeRequest, BridgeResponse, ToolName } from '@local-seo/core/bridge'
import { main } from '../src/commands'
import type { NodeDeps } from '../src/core-adapter'
import { ExtensionLink } from '../src/extension-link'
import { createMcpServer } from '../src/mcp'
import { parseHtml } from '../src/node-io'
import { SHAPES } from '../src/tools'

const links: ExtensionLink[] = []
const sockets: WebSocket[] = []
const servers: WebSocketServer[] = []

/** The secret `local-seo pair` printed and the user entered in the extension. */
const SECRET = newPairingSecret()

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  for (const server of servers.splice(0)) server.close()
  await Promise.all(links.splice(0).map((link) => link.close()))
})

async function startLink(connectWaitMs = 0): Promise<{ link: ExtensionLink; port: number }> {
  const port = 40_000 + Math.floor(Math.random() * 20_000)
  const link = new ExtensionLink({
    port,
    allowedOrigin: EXTENSION_ORIGIN,
    secret: SECRET,
    log: () => {},
    connectWaitMs,
  })
  links.push(link)
  await link.listening()
  return { link, port }
}

/**
 * Connects as the extension and runs its side of pairing: 'paired' once both proofs pass, else
 * the close or refusal code. Listening starts before the socket opens, since the bridge's
 * challenge can arrive in the same packet as the upgrade.
 */
function pairAs(
  port: number,
  secret: Uint8Array<ArrayBuffer>,
  onRequest: (data: string, socket: WebSocket) => void = () => {},
): Promise<'paired' | number> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin: EXTENSION_ORIGIN })
  sockets.push(socket)
  const step = pairingKey(secret).then(extensionSide)
  let paired = false
  return new Promise((resolve) => {
    socket.on('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0))
    socket.on('close', (code) => resolve(code))
    socket.on('message', (data) => {
      if (paired) return onRequest(String(data), socket)
      void step
        .then((next) => next(String(data)))
        .then((next) => {
          if (next.kind === 'reply') return socket.send(next.data)
          if (next.kind === 'refused') return socket.close()
          socket.send(next.data)
          paired = true
          resolve('paired')
        })
    })
  })
}

/** Opens a socket as a client with this Origin; resolves with the open socket or the refusal. */
function connect(port: number, origin: string): Promise<WebSocket | number> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin })
  return new Promise((resolve) => {
    socket.on('open', () => {
      sockets.push(socket)
      resolve(socket)
    })
    socket.on('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0))
  })
}

/**
 * Connects as the extension and answers each request with `answer`'s result; a null answer
 * leaves the request unanswered. Returns every request it received.
 */
async function fakeExtension(
  port: number,
  answer: (request: BridgeRequest) => unknown,
): Promise<BridgeRequest[]> {
  const received: BridgeRequest[] = []
  const outcome = await pairAs(port, SECRET, (data, extension) => {
    const request = JSON.parse(data) as BridgeRequest
    received.push(request)
    const result = answer(request)
    if (result === null) return
    const response: BridgeResponse =
      result instanceof Error
        ? { id: request.id, ok: false, error: result.message }
        : { id: request.id, ok: true, result }
    extension.send(JSON.stringify(response))
  })
  if (outcome !== 'paired') throw new Error(`pairing failed: ${outcome}`)
  // The bridge attaches the socket as it sends its proof, a moment before the client reads it.
  while (!links.some((link) => link.connected())) await new Promise((r) => setTimeout(r, 5))
  return received
}

// These tests go through the extension, so Node must never fetch unless a test says so.
const offline = (): never => {
  throw new Error('no network in tests')
}
const OFFLINE: NodeDeps = { fetcher: { fetch: offline }, parse: offline, now: () => new Date() }

async function agent(link: ExtensionLink, timeoutMs = 1_000, deps = OFFLINE): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const timeouts = Object.fromEntries(Object.keys(SHAPES).map((tool) => [tool, timeoutMs]))
  await createMcpServer(link, 'test', deps, timeouts as Record<ToolName, number>).connect(
    serverSide,
  )
  const client = new Client({ name: 'test-agent', version: '1' })
  await client.connect(clientSide)
  return client
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const [first] = result.content as { type: string; text: string }[]
  return first?.text ?? ''
}

describe('the extension link', () => {
  it('refuses a web page, or any origin other than the extension', async () => {
    const { link, port } = await startLink()

    expect(await connect(port, 'https://evil.example')).toBe(403)
    expect(await connect(port, 'chrome-extension://aaaabbbbccccddddeeeeffffgggghhhh')).toBe(403)
    expect(link.connected()).toBe(false)
  })

  it('accepts one paired extension at a time', async () => {
    const { port } = await startLink()

    await fakeExtension(port, () => ({}))
    expect(await connect(port, EXTENSION_ORIGIN)).toBe(409)
  })

  it('refuses an extension with another pairing code, and sends it no request', async () => {
    const { link, port } = await startLink()
    const requests: string[] = []

    const outcome = await pairAs(port, newPairingSecret(), (data) => requests.push(data))
    const client = await agent(link)
    const result = await client.callTool({
      name: 'profile_history',
      arguments: { business: { cid: '111' } },
    })

    expect(outcome).toBe(PAIRING_REFUSED)
    expect(link.connected()).toBe(false)
    expect(requests).toEqual([])
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('pairing code that does not match')
  })

  it('is refused by the extension when it cannot prove it holds the code', async () => {
    // A program squatting on the bridge's port, with a code of its own.
    const port = 40_000 + Math.floor(Math.random() * 20_000)
    const impostor = new WebSocketServer({ host: '127.0.0.1', port })
    servers.push(impostor)
    await new Promise((resolve) => impostor.once('listening', resolve))
    const impostorKey = await pairingKey(newPairingSecret())
    impostor.on('connection', (socket) => {
      const side = bridgeSide(impostorKey)
      // Without the code it cannot sign the extension's nonce, so its welcome is a guess.
      socket.once('message', () => {
        socket.send(JSON.stringify({ type: 'welcome', mac: 'ab'.repeat(32) }))
        socket.send(JSON.stringify({ id: '1', tool: 'profile_history', args: {} }))
      })
      socket.send(side.challenge)
    })
    const requests: string[] = []

    const outcome = await pairAs(port, SECRET, (data) => requests.push(data))

    expect(outcome).not.toBe('paired')
    expect(requests).toEqual([])
  })

  it('reads back the secret from the code the user types, in any case or spacing', () => {
    const code = pairingCode(SECRET)

    expect(code).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{1,4}){6}$/)
    expect(secretFromCode(code.toLowerCase().replace(/-/g, ' '))).toEqual(SECRET)
    expect(secretFromCode('not a code')).toBeNull()
  })
})

describe('an agent', () => {
  it('finds every Local SEO tool, each marked read-only', async () => {
    const { link } = await startLink()
    const client = await agent(link)

    const { tools } = await client.listTools()

    expect(client.getServerVersion()).toMatchObject({ name: 'local-seo', version: 'test' })
    expect(tools.map((tool) => tool.name).sort()).toEqual(Object.keys(SHAPES).sort())
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true)
  })

  it("gets the extension's answer to a tool call, with the arguments it gave", async () => {
    const { link, port } = await startLink()
    const received = await fakeExtension(port, () => ({ rank: { kind: 'ranked', rank: 2 } }))
    const client = await agent(link)

    const result = await client.callTool({
      name: 'rank_at',
      arguments: {
        query: 'emergency plumber',
        business: { cid: '111' },
        at: { lat: 41.1, lng: -73.99 },
      },
    })

    expect(result.isError).toBeFalsy()
    expect(JSON.parse(textOf(result))).toEqual({ rank: { kind: 'ranked', rank: 2 } })
    expect(received).toEqual([
      {
        id: expect.any(String),
        tool: 'rank_at',
        args: {
          query: 'emergency plumber',
          business: { cid: '111' },
          at: { lat: 41.1, lng: -73.99 },
        },
      },
    ])
  })

  it('waits for an extension that connects after its call, as at the start of a session', async () => {
    const { link, port } = await startLink(5_000)
    const client = await agent(link, 10_000)
    const call = client.callTool({
      name: 'rank_at',
      arguments: { query: 'plumber', business: { cid: '111' }, at: { lat: 41.1, lng: -73.99 } },
    })
    // The extension's retry alarm brings it in a moment later.
    await new Promise((resolve) => setTimeout(resolve, 300))
    await fakeExtension(port, () => ({ rank: { kind: 'ranked', rank: 1 } }))

    const result = await call
    expect(result.isError).toBeFalsy()
    expect(JSON.parse(textOf(result))).toEqual({ rank: { kind: 'ranked', rank: 1 } })
  })

  it('is told what is wrong with invalid arguments, which never reach the extension', async () => {
    const { link, port } = await startLink()
    const received = await fakeExtension(port, () => ({}))
    const client = await agent(link)

    const result = await client.callTool({
      name: 'geo_grid',
      arguments: {
        query: 'emergency plumber',
        business: { placeId: 'ChIJtarget' },
        center: { lat: 41.1, lng: -73.99 },
        size: 4,
        spacingKm: 1,
      },
    })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('size must be odd')
    expect(received).toEqual([])
  })

  it('gets an error naming the tool when the extension does not answer in time', async () => {
    const { link, port } = await startLink()
    await fakeExtension(port, () => null)
    const client = await agent(link, 50)

    const result = await client.callTool({
      name: 'profile_history',
      arguments: { business: { placeId: 'ChIJtarget' } },
    })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe('The extension did not answer profile_history within 0.05 s.')
  })

  it('gets the website check from Node when the extension may not read that site', async () => {
    const { link, port } = await startLink()
    const received = await fakeExtension(
      port,
      () => new Error('Local SEO has no access to www.nyackplumbing.com yet. To allow it, …'),
    )
    const page = readFileSync(new URL('./fixtures/location-page.html', import.meta.url), 'utf8')
    const site: NodeDeps = {
      fetcher: { fetch: async ({ url }) => ({ url, status: 200, headers: {}, body: page }) },
      parse: parseHtml,
      now: () => new Date('2026-11-02T12:00:00Z'),
    }
    const client = await agent(link, 1_000, site)

    const result = await client.callTool({
      name: 'check_website_nap',
      arguments: {
        url: 'https://www.nyackplumbing.com/',
        profile: { name: 'Nyack Plumbing Co', phone: '+1 845-555-0100' },
      },
    })

    expect(received).toHaveLength(1)
    expect(result.isError).toBeFalsy()
    expect(JSON.parse(textOf(result))).toMatchObject({
      profileFrom: 'arguments',
      website: { phone: { status: 'match' } },
    })
  })

  it('is told to open Chrome when no extension is connected', async () => {
    const { link } = await startLink()
    const client = await agent(link)

    const result = await client.callTool({
      name: 'read_reviews',
      arguments: { business: { name: 'Nyack Plumbing Co', city: 'West Nyack, NY' } },
    })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain(
      'Open Chrome with the extension installed, turn on Agent connection',
    )
  })
})

describe('local-seo pair', () => {
  it('saves a code only the user can read, prints it again, and --reset renews it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'local-seo-'))
    const pairingFile = join(dir, 'local-seo', 'bridge-token')
    const deps = { ...OFFLINE, pairingFile }
    const pair = async (...flags: string[]) => {
      let output = ''
      const code = await main(['pair', ...flags], (text) => (output += text), deps)
      return { code, output }
    }

    const first = await pair()
    const again = await pair()
    const renewed = await pair('--reset')

    expect(first.code).toBe(0)
    expect(first.output).toMatch(/^Pairing code: [A-Z2-7-]{32}\n/)
    expect(first.output).toContain('Settings, Agent connection')
    expect(again.output).toBe(first.output)
    expect(renewed.output).not.toBe(first.output)
    expect(renewed.output).toContain('must be paired again')
    expect((await stat(pairingFile)).mode & 0o777).toBe(0o600)
    expect((await stat(dirname(pairingFile))).mode & 0o777).toBe(0o700)
    await rm(dir, { recursive: true })
  })
})
