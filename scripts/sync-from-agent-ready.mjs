#!/usr/bin/env node
// Copies the code this project shares with Agent Ready into vendor/agent-ready/: its core package
// (vault, spend caps, response cache, DataForSEO plumbing, page snapshot and schema readers) and
// its copy of the WorkPods theme, fonts, logo and contracts. Paths mirror the Agent Ready checkout,
// so the core's own relative imports (../../../vendor/workpods/...) and its tsconfig's
// ../../tsconfig.base.json resolve inside vendor/agent-ready unchanged. The flow is one way:
// Agent Ready never reads this repo, and nothing here reads Agent Ready at build or run time.
//
//   node scripts/sync-from-agent-ready.mjs --from <agent-ready checkout>           copy and record
//   node scripts/sync-from-agent-ready.mjs --from <agent-ready checkout> --check   exit 1 if stale
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR = join(ROOT, 'vendor/agent-ready')
const RECORD = 'SOURCE.json'

// Paths in the Agent Ready checkout that cross over: a directory brings everything under it.
const SOURCES = [
  'packages/core/src',
  'packages/core/package.json',
  'packages/core/tsconfig.json',
  'tsconfig.base.json',
  'vendor/workpods',
]

const args = process.argv.slice(2)
const fromIndex = args.indexOf('--from')
if (fromIndex === -1 || !args[fromIndex + 1]) {
  console.error('usage: sync-from-agent-ready.mjs --from <agent-ready checkout> [--check]')
  process.exit(2)
}
const from = resolve(args[fromIndex + 1])
const check = args.includes('--check')

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

function filesUnder(base, path) {
  const full = join(base, path)
  if (!existsSync(full)) return null
  if (!statSync(full).isDirectory()) return [path]
  return readdirSync(full).flatMap((name) => filesUnder(base, join(path, name)) ?? [])
}

const wanted = SOURCES.flatMap((source) => {
  const files = filesUnder(from, source)
  if (files === null) {
    console.error(`missing in the Agent Ready checkout: ${source}`)
    process.exit(1)
  }
  return files
}).sort()

const stale = []
const hashes = {}
for (const path of wanted) {
  const targetPath = join(VENDOR, path)
  hashes[path] = sha256(join(from, path))
  const current = existsSync(targetPath) ? sha256(targetPath) : null
  if (current === hashes[path]) continue
  stale.push(path)
  if (!check) {
    mkdirSync(dirname(targetPath), { recursive: true })
    copyFileSync(join(from, path), targetPath)
  }
}

// A file Agent Ready deleted must not linger here, or the core would keep code it no longer has.
const kept = new Set([...wanted, RECORD])
const present = existsSync(VENDOR) ? (filesUnder(VENDOR, '.') ?? []) : []
const extra = present.map((path) => relative('.', path)).filter((path) => !kept.has(path))
for (const path of extra) {
  stale.push(`${path} (removed upstream)`)
  if (!check) rmSync(join(VENDOR, path))
}

if (check) {
  if (stale.length > 0) {
    console.error(`vendor/agent-ready is stale: ${stale.join(', ')}`)
    process.exit(1)
  }
  console.log('vendor/agent-ready matches the Agent Ready checkout')
} else {
  const commit = execFileSync('git', ['-C', from, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const record = { commit, files: hashes }
  writeFileSync(join(VENDOR, RECORD), `${JSON.stringify(record, null, 2)}\n`)
  console.log(`copied ${stale.length} changed file(s) from Agent Ready ${commit.slice(0, 9)}`)
}
