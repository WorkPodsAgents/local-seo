#!/usr/bin/env node
// Writes plugin/skills/gbp-audit/references/checks.md from the core's check registry, so the
// check ids, titles and fixes skills read cannot drift from the ones the audit reports. The skill
// lint calls checksMarkdown() and fails when the committed file differs.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const registryPath = join(pluginDir, '..', 'packages/core/src/registry/local-checks.json')
export const CHECKS_PATH = join(pluginDir, 'skills/gbp-audit/references/checks.md')

/** "profile_basics" reads "Profile basics"; the registry's labels live in TypeScript. */
function heading(group) {
  const words = group.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function checksMarkdown() {
  const { checks } = JSON.parse(readFileSync(registryPath, 'utf8'))
  const groups = [...new Set(checks.map((check) => check.group))]
  const lines = [
    '# Local SEO checks',
    '',
    'Generated from `packages/core/src/registry/local-checks.json` by',
    '`plugin/scripts/checks-reference.mjs`; edit the registry, not this file. Severity is what',
    'the audit reports on a fail or partial.',
  ]
  for (const group of groups) {
    lines.push('', `## ${heading(group)}`, '')
    for (const check of checks.filter((entry) => entry.group === group)) {
      lines.push(`- **${check.id} ${check.title}** (${check.severity}). ${check.rubric}`)
      lines.push(`  Fix: ${check.fix}`)
    }
  }
  return lines.join('\n') + '\n'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(CHECKS_PATH, checksMarkdown())
  console.log(`Wrote ${CHECKS_PATH}`)
}
