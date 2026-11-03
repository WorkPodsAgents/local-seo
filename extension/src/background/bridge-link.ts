// The link to the local MCP bridge. The extension connects out to the bridge on 127.0.0.1 when the
// user turns on "Agent connection"; the bridge accepts only this extension's origin. Any local
// program could listen on that port, so the bridge must prove it holds the pairing code before
// any request it sends is run. Each request runs the router's `tool:<name>` handler, which works
// from the user's own connections, so no credential crosses the socket.
import {
  BRIDGE_PORT,
  extensionSide,
  HANDSHAKE_TIMEOUT_MS,
  pairingKey,
  PAIRING_REFUSED,
  secretFromCode,
  type BridgeRequest,
  type BridgeResponse,
} from '@local-seo/core/bridge'
import type { LinkState } from '../shared/settings'
import { idbGet, idbSet } from './idb'
import { errorText } from './messages'
import { dispatch } from './router'

/** The pairing key, kept as a non-extractable CryptoKey: it signs, but never reads back. */
const PAIRING_KEY = 'bridge-pairing'

const RETRY_ALARM = 'bridge-retry'
/**
 * Chrome runs alarms no sooner than 30 seconds apart. Retries stop backing off at a minute: the
 * bridge starts only when an agent needs it and waits about that long for the extension, so a
 * longer gap would fail the agent's first calls. A refused localhost connection costs nothing.
 */
const RETRY_MINUTES = [0.5, 1]
/**
 * Chrome stops an idle service worker after 30 seconds, and socket traffic counts as activity.
 * The bridge drops an answer to no request it sent, so this one keeps the link alive unnoticed.
 */
const KEEPALIVE_MS = 20_000
const KEEPALIVE: BridgeResponse = { id: 'keepalive', ok: true, result: null }

let socket: WebSocket | null = null
/** True between deciding to connect and having a socket, so two syncs never open two. */
let opening = false
let state: LinkState = 'off'
let failures = 0
let keepalive: ReturnType<typeof setInterval> | null = null
let onChange: (state: LinkState) => void = () => undefined

export function linkState(): LinkState {
  return state
}

export function watchLinkState(listener: (state: LinkState) => void): void {
  onChange = listener
}

export async function isPaired(): Promise<boolean> {
  return (await idbGet<CryptoKey>('device', PAIRING_KEY)) !== undefined
}

/**
 * Saves the code `local-seo pair` printed and reconnects with it. The code is checked only for
 * its form here; whether it is the bridge's own shows in the handshake.
 */
export async function pairWithBridge(code: string, enabled: boolean): Promise<void> {
  const secret = secretFromCode(code)
  if (secret === null) {
    throw new Error('That is not a pairing code. Copy the code `local-seo pair` printed.')
  }
  await idbSet('device', PAIRING_KEY, await pairingKey(secret))
  await syncBridgeLink(false)
  await syncBridgeLink(enabled)
}

/** Opens or closes the link to match the setting; safe to call on every service worker start. */
export async function syncBridgeLink(enabled: boolean): Promise<void> {
  if (!enabled) {
    await browser.alarms.clear(RETRY_ALARM)
    failures = 0
    socket?.close()
    socket = null
    setState('off')
    return
  }
  if (socket !== null || opening) return
  opening = true
  try {
    const key = await idbGet<CryptoKey>('device', PAIRING_KEY)
    if (key === undefined) setState('unpaired')
    else connect(key)
  } finally {
    opening = false
  }
}

/** Registered at the top level, so an alarm that wakes the service worker still reconnects. */
export function listenForRetries(
  isEnabled: () => Promise<boolean>,
  failed: (error: unknown) => void,
): void {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== RETRY_ALARM) return
    void isEnabled()
      .then((enabled) => syncBridgeLink(enabled))
      .catch(failed)
  })
}

function connect(key: CryptoKey): void {
  setState('connecting')
  const ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}`)
  socket = ws
  const pairing = extensionSide(key)
  let paired = false
  let mismatch = false
  // Whatever answers on the port must finish the handshake in time, or it is not the bridge.
  const deadline = setTimeout(() => ws.close(), HANDSHAKE_TIMEOUT_MS)
  ws.onmessage = (event) => {
    const data = String(event.data)
    if (paired) return void answer(ws, data)
    void pairing(data).then((step) => {
      if (step.kind === 'reply') return ws.send(step.data)
      clearTimeout(deadline)
      if (step.kind === 'refused') {
        mismatch = true
        return ws.close()
      }
      ws.send(step.data)
      paired = true
      failures = 0
      setState('connected')
      keepalive = setInterval(() => ws.send(JSON.stringify(KEEPALIVE)), KEEPALIVE_MS)
    })
  }
  ws.onclose = (event) => {
    clearTimeout(deadline)
    if (keepalive !== null) clearInterval(keepalive)
    keepalive = null
    if (socket !== ws) return
    socket = null
    // The bridge runs only while an agent uses it, so a closed link waits for the next one; a
    // pairing that failed keeps saying so until the user pairs again or it succeeds.
    const delayInMinutes = RETRY_MINUTES[Math.min(failures, RETRY_MINUTES.length - 1)] ?? 10
    failures += 1
    void browser.alarms.create(RETRY_ALARM, { delayInMinutes })
    setState(mismatch || event.code === PAIRING_REFUSED ? 'mismatch' : 'waiting')
  }
}

async function answer(ws: WebSocket, data: string): Promise<void> {
  const request = parseRequest(data)
  if (request === null) return
  let response: BridgeResponse
  try {
    const result = await dispatch(`tool:${request.tool}`, request.args, null)
    response = { id: request.id, ok: true, result }
  } catch (error) {
    response = { id: request.id, ok: false, error: errorText(error) }
  }
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(response))
}

function parseRequest(data: string): BridgeRequest | null {
  try {
    const value: unknown = JSON.parse(data)
    if (typeof value !== 'object' || value === null) return null
    if (!('id' in value) || typeof value.id !== 'string') return null
    if (!('tool' in value) || typeof value.tool !== 'string' || !('args' in value)) return null
    // The tool handler checks its own arguments; an unknown tool fails in dispatch.
    return value as BridgeRequest
  } catch {
    return null
  }
}

function setState(next: LinkState): void {
  if (next === state) return
  state = next
  onChange(next)
}
