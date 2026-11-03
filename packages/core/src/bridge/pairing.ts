// Pairing the bridge with the extension. Any local process can open a socket to the bridge with a
// forged Origin, or listen on the bridge's port while it is not running, so each side proves it
// holds the secret the user carried from `local-seo pair` into the extension's Settings: an
// HMAC-SHA256 of a fresh nonce from the other side. Neither sends a tool request, nor runs one,
// until both proofs check out. WebCrypto runs in Node and the service worker alike.

/** 128 bits: far past guessing within the few seconds a handshake is allowed. */
const PAIRING_BYTES = 16

/** The close code the bridge sends an extension whose proof failed, so it can say why. */
export const PAIRING_REFUSED = 4001

/** How long either side waits for the other's next handshake message. */
export const HANDSHAKE_TIMEOUT_MS = 5_000

/** The handshake, in order: the bridge challenges, the extension proves and challenges back. */
type Handshake =
  | { readonly type: 'challenge'; readonly nonce: string }
  | { readonly type: 'proof'; readonly mac: string; readonly nonce: string }
  | { readonly type: 'welcome'; readonly mac: string }

/** Who signs: each side signs its own role, so one side's proof never passes as the other's. */
type PairingRole = 'extension' | 'bridge'

// RFC 4648 base32 without padding: no 0/1/8/9, so a code read aloud or retyped stays unambiguous.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const GROUP = 4

/** A new random secret. */
export function newPairingSecret(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(PAIRING_BYTES))
}

/** The secret as the code the user types: base32 in groups of four, "ABCD-EFGH-…". */
export function pairingCode(secret: Uint8Array): string {
  let bits = 0
  let value = 0
  let code = ''
  for (const byte of secret) {
    value = ((value << 8) | byte) & 0xffff
    bits += 8
    while (bits >= 5) {
      code += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) code += ALPHABET[(value << (5 - bits)) & 31]
  return code.match(new RegExp(`.{1,${GROUP}}`, 'g'))?.join('-') ?? ''
}

/** The secret a code stands for, ignoring case, spaces and dashes; null for anything else. */
export function secretFromCode(code: string): Uint8Array<ArrayBuffer> | null {
  const letters = code.toUpperCase().replace(/[\s-]+/g, '')
  if (letters.length !== Math.ceil((PAIRING_BYTES * 8) / 5)) return null
  const secret = new Uint8Array(PAIRING_BYTES)
  let bits = 0
  let value = 0
  let at = 0
  for (const letter of letters) {
    const index = ALPHABET.indexOf(letter)
    if (index < 0) return null
    value = ((value << 5) | index) & 0xffff
    bits += 5
    if (bits >= 8) {
      if (at < PAIRING_BYTES) secret[at] = (value >>> (bits - 8)) & 0xff
      at += 1
      bits -= 8
    }
  }
  return secret
}

/** The HMAC key for a secret; not extractable, so a stored key never gives the code back. */
export function pairingKey(secret: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

function newNonce(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

/** `role`'s proof that it holds the key, over the nonce the other side sent. */
async function prove(key: CryptoKey, role: PairingRole, nonce: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', key, signed(role, nonce))
  return toHex(new Uint8Array(mac))
}

/** Whether `mac` is `role`'s proof over `nonce`; WebCrypto compares in constant time. */
async function proves(
  key: CryptoKey,
  role: PairingRole,
  nonce: string,
  mac: string,
): Promise<boolean> {
  const bytes = fromHex(mac)
  if (bytes === null) return false
  return crypto.subtle.verify('HMAC', key, bytes, signed(role, nonce))
}

/** What the extension does with a message while pairing. */
export type ExtensionStep =
  | { readonly kind: 'reply'; readonly data: string }
  /** Both proofs passed: send `data`, the ready signal, and only then take requests. */
  | { readonly kind: 'paired'; readonly data: string }
  /** The bridge did not prove it holds the code, or broke the handshake: close, run nothing. */
  | { readonly kind: 'refused' }

/**
 * The extension's side, fed each message until it answers paired: it proves itself against the
 * bridge's challenge with a challenge of its own, then checks the bridge's proof.
 */
export function extensionSide(key: CryptoKey): (data: string) => Promise<ExtensionStep> {
  let ours: string | null = null
  return async (data) => {
    const message = parseHandshake(data)
    if (ours === null && message?.type === 'challenge') {
      const nonce = newNonce()
      ours = nonce
      const mac = await prove(key, 'extension', message.nonce)
      return { kind: 'reply', data: JSON.stringify({ type: 'proof', mac, nonce }) }
    }
    if (ours !== null && message?.type === 'welcome') {
      if (await proves(key, 'bridge', ours, message.mac)) return { kind: 'paired', data: READY }
    }
    return { kind: 'refused' }
  }
}

/**
 * The bridge's side: `challenge` opens the handshake; `answer` checks the extension's proof and
 * gives the welcome to send back, or null when the extension does not hold the code.
 */
export function bridgeSide(key: CryptoKey): {
  readonly challenge: string
  answer(data: string): Promise<string | null>
} {
  const nonce = newNonce()
  return {
    challenge: JSON.stringify({ type: 'challenge', nonce }),
    async answer(data) {
      const message = parseHandshake(data)
      if (message?.type !== 'proof') return null
      if (!(await proves(key, 'extension', nonce, message.mac))) return null
      const mac = await prove(key, 'bridge', message.nonce)
      return JSON.stringify({ type: 'welcome', mac })
    },
  }
}

/**
 * The extension's last word: it has checked the bridge's proof. The bridge sends no request
 * before this, since one arriving while the extension still checks would read as a broken
 * handshake and close the link.
 */
const READY = JSON.stringify({ type: 'ready' })

/** Whether a message is the extension's ready signal. */
export function isReady(data: string): boolean {
  return data === READY
}

/** A handshake message, or null for anything else (a tool request, a malformed frame). */
function parseHandshake(data: string): Handshake | null {
  let value: unknown
  try {
    value = JSON.parse(data)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null || !('type' in value)) return null
  const field = (name: string) => {
    const found = (value as Record<string, unknown>)[name]
    return typeof found === 'string' && found.length <= 128 ? found : null
  }
  const nonce = field('nonce')
  const mac = field('mac')
  if (value.type === 'challenge' && nonce !== null) return { type: 'challenge', nonce }
  if (value.type === 'proof' && nonce !== null && mac !== null) return { type: 'proof', mac, nonce }
  if (value.type === 'welcome' && mac !== null) return { type: 'welcome', mac }
  return null
}

function signed(role: PairingRole, nonce: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`local-seo ${role} ${nonce}`)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(text)) return null
  return Uint8Array.from(text.match(/../g) ?? [], (pair) => parseInt(pair, 16))
}
