// The encrypted vault for the user's provider credentials.
//
// One storage record holds the PBKDF2 salt, a verifier and every secret, each sealed with AES-GCM
// under a 256-bit key derived from the user's passphrase. One record makes a passphrase change a
// single write, so a crash can never leave secrets split across two keys. Each secret's name is its
// AES-GCM additional data, so a sealed value cannot be moved under another name.
//
// The derived key must outlive the MV3 service worker, which Chrome stops after 30 idle seconds and
// whose memory goes with it. So its raw bytes go to `sessionKeyStore`, which the extension maps to
// chrome.storage.session: memory only, cleared when the browser closes, and closed to content
// scripts. Every use imports those bytes as a non-extractable CryptoKey that lives for one call.
//
// "Remember on this device" seals the same raw bytes with a non-extractable AES key kept by
// `deviceKeyStore` (IndexedDB in the extension). A copy of the storage files then cannot open the
// vault, but malware running as the user still can; the settings screen says so.
//
// Errors carry a code only. Nothing here logs, and no error or return value contains a secret.
import type { KeyValueStore } from '../providers/store'
import { serialized } from '../providers/store'
import { fromBase64, toBase64 } from './base64'
import type { SecretName } from './names'

/** Holds the derived key's raw bytes for one browser session. */
export interface SessionKeyStore {
  get(): Promise<Uint8Array | null>
  set(rawKey: Uint8Array): Promise<void>
  clear(): Promise<void>
}

/** Holds one non-extractable CryptoKey on this device. */
export interface DeviceKeyStore {
  get(): Promise<CryptoKey | null>
  set(key: CryptoKey): Promise<void>
  clear(): Promise<void>
}

export type VaultFailure =
  | 'not_set_up'
  | 'already_set_up'
  | 'locked'
  | 'wrong_passphrase'
  | 'weak_passphrase'
  | 'device_unavailable'
  | 'corrupt'

export class VaultError extends Error {
  readonly code: VaultFailure
  constructor(code: VaultFailure) {
    super(`vault: ${code}`)
    this.name = 'VaultError'
    this.code = code
  }
}

export interface Vault {
  isSetUp(): Promise<boolean>
  /** Creates the vault and leaves it unlocked. */
  setUp(passphrase: string): Promise<void>
  unlock(passphrase: string): Promise<void>
  /** Unlocks with the key remembered on this device; false when none is remembered. */
  unlockOnDevice(): Promise<boolean>
  /** Remembers the unlocked vault's key on this device. */
  rememberOnDevice(): Promise<void>
  forgetDevice(): Promise<void>
  lock(): Promise<void>
  isUnlocked(): Promise<boolean>
  set(name: SecretName, value: string): Promise<void>
  /** The secret, or null when it is not configured. */
  get(name: SecretName): Promise<string | null>
  remove(name: SecretName): Promise<void>
  has(name: SecretName): Promise<boolean>
  /** The names configured, never their values. */
  listConfigured(): Promise<SecretName[]>
  changePassphrase(current: string, next: string): Promise<void>
  /** Deletes the vault, the session key and the device key. */
  wipe(): Promise<void>
}

export interface VaultOptions {
  readonly storage: KeyValueStore
  readonly sessionKeyStore: SessionKeyStore
  readonly deviceKeyStore?: DeviceKeyStore
  /** PBKDF2 rounds for a new vault; tests lower it to stay fast. Unlock uses the stored count. */
  readonly iterations?: number
}

/** OWASP's 2023 figure for PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000
const MIN_PASSPHRASE = 8
const RECORD_KEY = 'vault'
const VERIFIER = 'open-agent-ready vault'
const VERIFIER_AAD = '#verifier'
const DEVICE_AAD = '#device'

interface Sealed {
  readonly iv: string
  readonly data: string
}

interface VaultRecord {
  readonly version: 1
  readonly salt: string
  readonly iterations: number
  readonly verifier: Sealed
  readonly secrets: Readonly<Partial<Record<SecretName, Sealed>>>
  /** The raw key sealed with the device key, when remembered. */
  readonly device?: Sealed
}

export function createVault(options: VaultOptions): Vault {
  const { storage, sessionKeyStore, deviceKeyStore } = options
  const iterations = options.iterations ?? PBKDF2_ITERATIONS
  const exclusive = serialized()

  async function read(): Promise<VaultRecord | null> {
    return parseRecord(await storage.get(RECORD_KEY))
  }

  async function required(): Promise<VaultRecord> {
    const record = await read()
    if (record === null) throw new VaultError('not_set_up')
    return record
  }

  async function sessionKey(): Promise<CryptoKey> {
    const raw = await sessionKeyStore.get()
    if (raw === null) throw new VaultError('locked')
    return aesKey(raw)
  }

  /** The raw key for `passphrase`, once the verifier proves it right. */
  async function rawKeyFor(record: VaultRecord, passphrase: string): Promise<Uint8Array> {
    const raw = await derive(passphrase, fromBase64(record.salt), record.iterations)
    const text = await openText(await aesKey(raw), record.verifier, VERIFIER_AAD)
    if (text !== VERIFIER) throw new VaultError('wrong_passphrase')
    return raw
  }

  async function freshRecord(
    passphrase: string,
  ): Promise<{ record: VaultRecord; raw: Uint8Array }> {
    if (passphrase.length < MIN_PASSPHRASE) throw new VaultError('weak_passphrase')
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const raw = await derive(passphrase, salt, iterations)
    const verifier = await sealText(await aesKey(raw), VERIFIER, VERIFIER_AAD)
    const record: VaultRecord = {
      version: 1,
      salt: toBase64(salt),
      iterations,
      verifier,
      secrets: {},
    }
    return { record, raw }
  }

  return {
    async isSetUp() {
      return (await read()) !== null
    },

    setUp: (passphrase) =>
      exclusive(async () => {
        if ((await read()) !== null) throw new VaultError('already_set_up')
        const { record, raw } = await freshRecord(passphrase)
        await storage.set(RECORD_KEY, record)
        await sessionKeyStore.set(raw)
      }),

    async unlock(passphrase) {
      const raw = await rawKeyFor(await required(), passphrase)
      await sessionKeyStore.set(raw)
    },

    async unlockOnDevice() {
      const record = await read()
      const deviceKey = deviceKeyStore === undefined ? null : await deviceKeyStore.get()
      if (record?.device === undefined || deviceKey === null) return false
      const raw = await open(deviceKey, record.device, DEVICE_AAD)
      if (raw === null) return false
      await sessionKeyStore.set(raw)
      return true
    },

    rememberOnDevice: () =>
      exclusive(async () => {
        if (deviceKeyStore === undefined) throw new VaultError('device_unavailable')
        const record = await required()
        const raw = await sessionKeyStore.get()
        if (raw === null) throw new VaultError('locked')
        const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
          'encrypt',
          'decrypt',
        ])
        const device = await seal(deviceKey, raw, DEVICE_AAD)
        await deviceKeyStore.set(deviceKey)
        await storage.set(RECORD_KEY, { ...record, device })
      }),

    forgetDevice: () =>
      exclusive(async () => {
        await deviceKeyStore?.clear()
        const record = await read()
        if (record?.device === undefined) return
        const { device: _forgotten, ...rest } = record
        await storage.set(RECORD_KEY, rest)
      }),

    async lock() {
      await sessionKeyStore.clear()
    },

    async isUnlocked() {
      return (await read()) !== null && (await sessionKeyStore.get()) !== null
    },

    set: (name, value) =>
      exclusive(async () => {
        const record = await required()
        const sealed = await sealText(await sessionKey(), value, name)
        await storage.set(RECORD_KEY, { ...record, secrets: { ...record.secrets, [name]: sealed } })
      }),

    async get(name) {
      const sealed = (await required()).secrets[name]
      const key = await sessionKey()
      if (sealed === undefined) return null
      const text = await openText(key, sealed, name)
      if (text === null) throw new VaultError('corrupt')
      return text
    },

    remove: (name) =>
      exclusive(async () => {
        const record = await required()
        const { [name]: _removed, ...secrets } = record.secrets
        await storage.set(RECORD_KEY, { ...record, secrets })
      }),

    async has(name) {
      return (await read())?.secrets[name] !== undefined
    },

    async listConfigured() {
      const record = await read()
      return record === null ? [] : secretNames(record)
    },

    changePassphrase: (current, next) =>
      exclusive(async () => {
        const record = await required()
        const oldKey = await aesKey(await rawKeyFor(record, current))
        const { record: fresh, raw } = await freshRecord(next)
        const newKey = await aesKey(raw)
        const secrets: Partial<Record<SecretName, Sealed>> = {}
        for (const name of secretNames(record)) {
          const sealed = record.secrets[name]
          const text = sealed === undefined ? null : await openText(oldKey, sealed, name)
          if (text === null) throw new VaultError('corrupt')
          secrets[name] = await sealText(newKey, text, name)
        }
        const deviceKey = record.device === undefined ? null : await deviceKeyStore?.get()
        const device = deviceKey ? await seal(deviceKey, raw, DEVICE_AAD) : undefined
        await storage.set(RECORD_KEY, { ...fresh, secrets, ...(device ? { device } : {}) })
        await sessionKeyStore.set(raw)
      }),

    wipe: () =>
      exclusive(async () => {
        await storage.remove(RECORD_KEY)
        await sessionKeyStore.clear()
        await deviceKeyStore?.clear()
      }),
  }
}

function secretNames(record: VaultRecord): SecretName[] {
  return (Object.keys(record.secrets) as SecretName[]).sort()
}

async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>, rounds: number) {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds },
    base,
    256,
  )
  return new Uint8Array(bits)
}

function aesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new Uint8Array(raw), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

async function seal(key: CryptoKey, plain: Uint8Array, aad: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
    key,
    new Uint8Array(plain),
  )
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) }
}

/** The plaintext, or null when the key or the additional data is wrong. */
async function open(key: CryptoKey, sealed: Sealed, aad: string): Promise<Uint8Array | null> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: new TextEncoder().encode(aad) },
      key,
      fromBase64(sealed.data),
    )
    return new Uint8Array(plain)
  } catch {
    // AES-GCM rejects a wrong key with an OperationError that says nothing more.
    return null
  }
}

function sealText(key: CryptoKey, text: string, aad: string): Promise<Sealed> {
  return seal(key, new TextEncoder().encode(text), aad)
}

async function openText(key: CryptoKey, sealed: Sealed, aad: string): Promise<string | null> {
  const plain = await open(key, sealed, aad)
  return plain === null ? null : new TextDecoder().decode(plain)
}

function parseRecord(value: unknown): VaultRecord | null {
  if (value === undefined || value === null) return null
  if (!isObject(value) || value['version'] !== 1) throw new VaultError('corrupt')
  const { salt, iterations, verifier, secrets, device } = value
  const valid =
    typeof salt === 'string' &&
    typeof iterations === 'number' &&
    isSealed(verifier) &&
    isObject(secrets) &&
    Object.values(secrets).every(isSealed) &&
    (device === undefined || isSealed(device))
  if (!valid) throw new VaultError('corrupt')
  return value as unknown as VaultRecord
}

function isSealed(value: unknown): value is Sealed {
  return isObject(value) && typeof value['iv'] === 'string' && typeof value['data'] === 'string'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
