// The bridge's side of the link to the extension: a WebSocket server on 127.0.0.1 that only the
// Local SEO extension may connect to, one at a time. Web pages can open WebSockets to
// localhost too, so the Origin check keeps a site the user visits from driving the tools; a
// local program can forge an Origin, so the extension must also prove it holds the pairing code
// before it counts as connected.
import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import {
  bridgeSide,
  HANDSHAKE_TIMEOUT_MS,
  isReady,
  pairingKey,
  PAIRING_REFUSED,
  type BridgeRequest,
  type BridgeResponse,
  type ToolArgs,
  type ToolName,
} from '@local-seo/core/bridge'

export class ExtensionNotConnected extends Error {}

interface Pending {
  readonly resolve: (result: unknown) => void
  readonly reject: (error: Error) => void
  readonly timer: NodeJS.Timeout
}

export interface ExtensionLinkOptions {
  readonly port: number
  readonly allowedOrigin: string
  /** The pairing secret `local-seo pair` printed as a code for the extension. */
  readonly secret: Uint8Array<ArrayBuffer>
  readonly log: (line: string) => void
  /**
   * How long a tool call waits for the extension to connect before failing. The agent starts the
   * bridge only when it needs it, and the extension retries on a Chrome alarm, at most a minute
   * apart, so the first calls of a session would otherwise fail while it is on its way.
   */
  readonly connectWaitMs?: number
}

export class ExtensionLink {
  private readonly server: WebSocketServer
  private readonly key: Promise<CryptoKey>
  /** The extension, once it proved it holds the pairing code; null until then. */
  private extension: WebSocket | null = null
  private readonly pending = new Map<string, Pending>()
  /** Why no extension can connect (another bridge holds the port), or null while listening. */
  private unavailable: string | null = null
  /** The last extension to try sent a proof that failed, so the codes differ. */
  private refused = false
  /** Calls waiting for the extension to connect, woken when it does. */
  private readonly arrivals = new Set<() => void>()

  constructor(private readonly options: ExtensionLinkOptions) {
    this.key = pairingKey(options.secret)
    this.server = new WebSocketServer({
      host: '127.0.0.1',
      port: options.port,
      verifyClient: (info: { origin: string; req: IncomingMessage }, done) => {
        if (info.origin !== options.allowedOrigin) return done(false, 403, 'Forbidden origin')
        if (this.extension !== null) return done(false, 409, 'An extension is already connected')
        done(true)
      },
    })
    this.server.on('connection', (socket) => void this.pair(socket))
    this.server.on('error', (error: NodeJS.ErrnoException) => {
      this.unavailable =
        error.code === 'EADDRINUSE'
          ? `port ${options.port} is in use, most likely by another Local SEO bridge`
          : error.message
      options.log(`Extension link unavailable: ${this.unavailable}`)
    })
  }

  /** Resolves once the server listens, so tests and callers know the port is open. */
  listening(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server.address() !== null) return resolve()
      this.server.once('listening', () => resolve())
    })
  }

  connected(): boolean {
    return this.extension !== null
  }

  /** Sends one tool call to the extension and waits for its answer, or fails after the timeout. */
  async call<T extends ToolName>(tool: T, args: ToolArgs[T], timeoutMs: number): Promise<unknown> {
    const extension = this.extension ?? (await this.arrival())
    if (extension === null) throw new ExtensionNotConnected(this.notConnected())
    const request: BridgeRequest<T> = { id: randomUUID(), tool, args }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.id)
        reject(new Error(`The extension did not answer ${tool} within ${timeoutMs / 1000} s.`))
      }, timeoutMs)
      this.pending.set(request.id, { resolve, reject, timer })
      extension.send(JSON.stringify(request))
    })
  }

  /** The extension once it connects within the wait; null when it does not or cannot. */
  private arrival(): Promise<WebSocket | null> {
    const wait = this.options.connectWaitMs ?? 0
    // A refused code or a taken port will not fix itself while the agent waits.
    if (wait <= 0 || this.refused || this.unavailable !== null) return Promise.resolve(null)
    return new Promise((resolve) => {
      const arrived = () => {
        clearTimeout(timer)
        this.arrivals.delete(arrived)
        resolve(this.extension)
      }
      const timer = setTimeout(arrived, wait)
      this.arrivals.add(arrived)
    })
  }

  close(): Promise<void> {
    this.failAll('The bridge is shutting down.')
    return new Promise((resolve) => {
      for (const client of this.server.clients) client.terminate()
      this.server.close(() => resolve())
    })
  }

  private notConnected(): string {
    if (this.refused) {
      return (
        'The Local SEO extension tried to connect with a pairing code that does not match. ' +
        'Run `npx @workpods/local-seo pair` and enter the code it prints in the extension: ' +
        'Settings, Agent connection, Re-pair. Then try again.'
      )
    }
    const reason = this.unavailable === null ? '' : ` (${this.unavailable})`
    return (
      `The Local SEO extension is not connected${reason}. Open Chrome with the extension ` +
      'installed, turn on Agent connection in its settings and pair it with the code ' +
      '`npx @workpods/local-seo pair` prints, then try again.'
    )
  }

  /** Attaches the socket only once it proved it holds the code, and proves the bridge does. */
  private async pair(socket: WebSocket): Promise<void> {
    const side = bridgeSide(await this.key)
    const timer = setTimeout(() => socket.terminate(), HANDSHAKE_TIMEOUT_MS)
    socket.once('message', (data) => {
      clearTimeout(timer)
      void side.answer(String(data)).then((welcome) => {
        if (welcome === null) {
          this.refused = true
          this.options.log(
            'Refused an extension whose pairing code does not match. Run `local-seo pair` and ' +
              'enter the code in the extension: Settings, Agent connection.',
          )
          return socket.close(PAIRING_REFUSED, 'Pairing code does not match')
        }
        if (this.extension !== null) return socket.close(1013, 'Another extension is connected')
        socket.send(welcome)
        // Requests wait for the extension's ready signal: it is still checking the welcome.
        const ready = setTimeout(() => socket.terminate(), HANDSHAKE_TIMEOUT_MS)
        socket.once('message', (next) => {
          clearTimeout(ready)
          if (!isReady(String(next))) return socket.close(PAIRING_REFUSED, 'Handshake broken')
          if (this.extension !== null) return socket.close(1013, 'Another extension is connected')
          this.attach(socket)
        })
      })
    })
    socket.send(side.challenge)
  }

  private attach(socket: WebSocket): void {
    this.extension = socket
    this.refused = false
    this.options.log('Extension connected.')
    for (const arrived of [...this.arrivals]) arrived()
    socket.on('message', (data) => this.settle(String(data)))
    socket.on('close', () => {
      if (this.extension === socket) this.extension = null
      this.failAll('The extension disconnected before it answered.')
      this.options.log('Extension disconnected.')
    })
  }

  private settle(data: string): void {
    const response = parseResponse(data)
    if (response === null)
      return this.options.log('Ignored a malformed message from the extension.')
    const waiting = this.pending.get(response.id)
    if (waiting === undefined) return
    this.pending.delete(response.id)
    clearTimeout(waiting.timer)
    if (response.ok) waiting.resolve(response.result)
    else waiting.reject(new Error(response.error))
  }

  private failAll(reason: string): void {
    for (const waiting of this.pending.values()) {
      clearTimeout(waiting.timer)
      waiting.reject(new Error(reason))
    }
    this.pending.clear()
  }
}

function parseResponse(data: string): BridgeResponse | null {
  let value: unknown
  try {
    value = JSON.parse(data)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null
  if (!('id' in value) || typeof value.id !== 'string' || !('ok' in value)) return null
  if (value.ok === true)
    return { id: value.id, ok: true, result: 'result' in value ? value.result : null }
  if (value.ok === false && 'error' in value && typeof value.error === 'string') {
    return { id: value.id, ok: false, error: value.error }
  }
  return null
}
