import { VaultError, type VaultFailure } from '@open-agent-ready/core/secrets'
import { emit } from '../shared/events'
import type { Status } from '../shared/settings'
import { isPaired, linkState, pairWithBridge, syncBridgeLink } from './bridge-link'
import { handle } from './handle'
import { idbClear } from './idb'
import { ledger } from './paid'
import { readSettings, saveSettings } from './settings'
import { isRemembered, vault } from './vault'
import { clearLocalStore } from './stores'

let problem: string | null = null

/** Catches work nobody awaits (start-up, alarms) and shows its failure in the panel. */
export function reportFailure(what: string): (error: unknown) => void {
  return (error) => {
    problem = `${what} failed: ${error instanceof Error ? error.message : String(error)}`
    void broadcastStatus().catch(() => undefined)
  }
}

export async function status(): Promise<Status> {
  const [setUp, unlocked, remembered, stored, spend, settings, paired] = await Promise.all([
    vault.isSetUp(),
    vault.isUnlocked(),
    isRemembered(),
    vault.listConfigured(),
    ledger.summary(),
    readSettings(),
    isPaired(),
  ])
  return {
    vault: !setUp ? 'empty' : unlocked ? 'unlocked' : 'locked',
    remembered,
    stored,
    link: linkState(),
    paired,
    spend,
    settings,
    problem,
  }
}

export async function broadcastStatus(): Promise<void> {
  emit('status', await status())
}

const VAULT_TEXT: Readonly<Record<VaultFailure, string>> = {
  not_set_up: 'Set up the vault first.',
  already_set_up: 'The vault is already set up.',
  locked: 'Unlock the vault first.',
  wrong_passphrase: 'That passphrase does not open the vault.',
  weak_passphrase: 'Use a passphrase of at least 8 characters.',
  device_unavailable: 'This browser cannot remember the vault key.',
  corrupt: 'The vault data is damaged. Wipe it in Settings and set it up again.',
}

/** Runs a change and answers with the new status, with vault failures in plain words. */
async function changed(change: () => Promise<unknown>): Promise<Status> {
  try {
    await change()
  } catch (error) {
    if (error instanceof VaultError) throw new Error(VAULT_TEXT[error.code])
    throw error
  }
  void broadcastStatus()
  return status()
}

async function remember(on: boolean): Promise<void> {
  if (on) await vault.rememberOnDevice()
  else await vault.forgetDevice()
}

export function registerStatusHandlers(): void {
  handle('status', status)
  handle('settings:save', ({ settings }) =>
    changed(async () => {
      await saveSettings(settings)
      await syncBridgeLink(settings.agentLink)
    }),
  )
  handle('bridge:pair', ({ code }) =>
    changed(async () => pairWithBridge(code, (await readSettings()).agentLink)),
  )
  handle('vault:setup', ({ passphrase, remember: on }) =>
    changed(async () => {
      await vault.setUp(passphrase)
      await remember(on)
    }),
  )
  handle('vault:unlock', ({ passphrase, remember: on }) =>
    changed(async () => {
      await vault.unlock(passphrase)
      await remember(on)
    }),
  )
  handle('vault:lock', () => changed(() => vault.lock()))
  handle('vault:set', ({ name, value }) => changed(() => vault.set(name, value.trim())))
  handle('vault:remove', ({ name }) => changed(() => vault.remove(name)))
  handle('spend:cap', ({ provider, usd }) => changed(() => ledger.setCap(provider, usd)))
  handle('data:wipe', () =>
    changed(async () => {
      await vault.wipe()
      await syncBridgeLink(false)
      await Promise.all([
        idbClear('results'),
        idbClear('cache'),
        idbClear('device'),
        clearLocalStore(),
      ])
    }),
  )
}

/** Unlocks with a key remembered on this device when the browser starts. */
export async function unlockOnDevice(): Promise<void> {
  if (await vault.isUnlocked()) return
  await vault.unlockOnDevice().catch(() => false)
}
