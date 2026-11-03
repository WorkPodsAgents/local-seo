// A small, stable, synchronous text hash, so pages with the same normalised text compare equal
// across a crawl without the async WebCrypto API. 64-bit FNV-1a over the UTF-8 bytes keeps
// collisions out of reach for a crawl's few hundred pages.

const OFFSET = 0xcbf29ce484222325n
const PRIME = 0x100000001b3n

export function fnv1a64(text: string): string {
  let hash = OFFSET
  for (const byte of new TextEncoder().encode(text)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * PRIME)
  }
  return hash.toString(16).padStart(16, '0')
}
