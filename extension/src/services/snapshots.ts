// Every profile the extension reads is kept as a snapshot on this device, so the next read can
// say what changed (a competitor's new name, a lost category, a suspended listing). Snapshots are
// keyed by the CID, the one id every Maps page and result carries; each other id points to it.
import type { BusinessRef, ProfileChange } from '@local-seo/core/bridge'
import type { Business, BusinessIds } from '@local-seo/core/business'
import { parseMapsUrl } from '@local-seo/core/geo'
import { profileChanges, sameProfile, type Snapshot } from '@local-seo/core/history'
import type { KeyValueStore } from '@open-agent-ready/core/providers'

/** Enough for a year of weekly visits; the oldest go first. */
const KEEP = 60

export interface SavedRead {
  /** The read before this one; null on the first. */
  readonly previous: Snapshot | null
  /** What changed since `previous`. */
  readonly changes: readonly ProfileChange[]
}

export interface SnapshotStore {
  save(business: Business): Promise<SavedRead>
  /** Oldest first; empty when the profile was never read or `ref` was never seen for it. */
  history(ref: BusinessRef): Promise<readonly Snapshot[]>
  /** Points `ref` (a short link, an id the panel did not show) at the saved place `ids` name. */
  remember(ref: BusinessRef, ids: BusinessIds): Promise<void>
}

export function createSnapshotStore(store: KeyValueStore): SnapshotStore {
  const listOf = async (key: string) =>
    ((await store.get(`snapshots:${key}`)) as Snapshot[] | undefined) ?? []
  const keyFor = async (aliases: readonly string[]): Promise<string | null> => {
    for (const alias of aliases) {
      const key = (await store.get(`snapshot-alias:${alias}`)) as string | undefined
      if (key !== undefined) return key
    }
    return null
  }
  return {
    async save(business) {
      const aliases = aliasesOf(business.ids, business.name)
      // Two places can share a name, so a name finds the record only when no id is known.
      const ids = aliases.filter((alias) => !alias.startsWith('name:'))
      const key = (await keyFor(ids.length > 0 ? ids : aliases)) ?? aliases[0] ?? ''
      const list = await listOf(key)
      const previous = list.at(-1) ?? null
      const snapshot = { readAt: business.readAt, business }
      // A read that adds nothing new moves no history; the last snapshot stands for it.
      if (previous === null || !sameProfile(previous.business, business)) {
        await store.set(`snapshots:${key}`, [...list, snapshot].slice(-KEEP))
      }
      for (const alias of aliases) await store.set(`snapshot-alias:${alias}`, key)
      return {
        previous,
        changes: previous === null ? [] : profileChanges([previous, snapshot]),
      }
    },
    async history(ref) {
      const key = await keyFor(refAliases(ref))
      return key === null ? [] : listOf(key)
    },
    async remember(ref, ids) {
      const key = await keyFor(aliasesOf(ids, null))
      if (key === null) return
      for (const alias of refAliases(ref)) await store.set(`snapshot-alias:${alias}`, key)
    },
  }
}

function aliasesOf(ids: BusinessIds, name: string | null): string[] {
  return [
    ids.cid === null ? null : `cid:${ids.cid}`,
    ids.placeId === null ? null : `place:${ids.placeId}`,
    ids.featureId === null ? null : `feature:${ids.featureId.toLowerCase()}`,
    ids.kgId === null ? null : `kg:${ids.kgId}`,
    name === null ? null : `name:${plain(name)}`,
  ].filter((alias): alias is string => alias !== null)
}

/**
 * The aliases a reference is looked up by. A name, or a link that names no id, can mean another
 * place of the same name, so it finds nothing until Maps has said whose it is (`remember`).
 */
function refAliases(ref: BusinessRef): string[] {
  if ('cid' in ref) return [`cid:${ref.cid}`]
  if ('placeId' in ref) return [`place:${ref.placeId}`]
  if ('name' in ref) return []
  const parts = parseMapsUrl(ref.mapsUrl)
  return [`url:${ref.mapsUrl.trim()}`, ...(parts === null ? [] : aliasesOf(parts.ids, null))]
}

function plain(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}
