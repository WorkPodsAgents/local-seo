// The pairing secret on this computer, kept as its code in a file only the user can read, so
// another account on the machine cannot pair with the user's extension.
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { newPairingSecret, pairingCode, secretFromCode } from '@local-seo/core/bridge'

/**
 * `~/.config/local-seo/bridge-token`. Not `$XDG_CONFIG_HOME`: agents start the bridge with a
 * trimmed environment that drops it, so the agent's bridge and the user's `local-seo pair` would
 * read two different files and never match.
 */
export function pairingFilePath(home: string = homedir()): string {
  return join(home, '.config', 'local-seo', 'bridge-token')
}

/** The saved secret; null when there is none or the file holds no valid code. */
export async function readPairing(path: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    return secretFromCode(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

/** A new secret saved over any old one; the extension must then be paired again. */
export async function createPairing(path: string): Promise<Uint8Array<ArrayBuffer>> {
  const secret = newPairingSecret()
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  // mkdir leaves an existing directory's mode alone, and the umask can loosen a new file's.
  await chmod(dirname(path), 0o700)
  await writeFile(path, `${pairingCode(secret)}\n`, { mode: 0o600 })
  await chmod(path, 0o600)
  return secret
}
