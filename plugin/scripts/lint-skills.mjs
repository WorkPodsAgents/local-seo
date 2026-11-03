#!/usr/bin/env node
// Fails when a skill names a bridge tool that does not exist, so a renamed or removed tool cannot
// leave skills telling agents to call it. Skills write tools as `local-seo:<tool>`; the
// tool list is ToolArgs in the core's bridge protocol. Also checks each SKILL.md's frontmatter,
// that relative links resolve, and that the generated checks reference matches the registry.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHECKS_PATH, checksMarkdown } from './checks-reference.mjs'

const pluginDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const protocolPath = join(pluginDir, '..', 'packages/core/src/bridge/protocol.ts')
const skillsDir = join(pluginDir, 'skills')

function toolNames() {
  const source = readFileSync(protocolPath, 'utf8')
  // Matches `{}` too, which is how the protocol reads before its first tool.
  const block = source.match(/export interface ToolArgs \{(?:\}|([\s\S]*?)\n\})/)
  if (block === null) throw new Error(`ToolArgs not found in ${protocolPath}`)
  const body = block[1] ?? ''
  return new Set([...body.matchAll(/^\s{2}([a-z_]+):/gm)].map((match) => match[1]))
}

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return entry.name.endsWith('.md') ? [path] : []
  })
}

function frontmatterProblems(skill, text) {
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (frontmatter === null) return ['has no frontmatter']
  const problems = []
  const name = frontmatter[1].match(/^name: (.+)$/m)?.[1]
  if (name !== skill) problems.push(`frontmatter name is ${name ?? 'missing'}, not ${skill}`)
  if (!/^description: .{40,}$/m.test(frontmatter[1])) problems.push('needs a description')
  return problems
}

function lint() {
  const tools = toolNames()
  const problems = []
  const skills = readdirSync(skillsDir, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  )
  for (const { name: skill } of skills) {
    const skillPath = join(skillsDir, skill, 'SKILL.md')
    if (!existsSync(skillPath)) {
      problems.push(`${skill}: no SKILL.md`)
      continue
    }
    for (const problem of frontmatterProblems(skill, readFileSync(skillPath, 'utf8'))) {
      problems.push(`${skill}/SKILL.md: ${problem}`)
    }
    for (const file of markdownFiles(join(skillsDir, skill))) {
      const where = file.slice(skillsDir.length + 1)
      const text = readFileSync(file, 'utf8')
      for (const [, tool] of text.matchAll(/local-seo:([a-z_]+)/g)) {
        if (!tools.has(tool)) problems.push(`${where}: names unknown tool ${tool}`)
      }
      for (const [, target] of text.matchAll(/\]\(([^)#:]+\.md)\)/g)) {
        if (!existsSync(join(dirname(file), target))) {
          problems.push(`${where}: broken link ${target}`)
        }
      }
    }
  }
  if (!existsSync(CHECKS_PATH) || readFileSync(CHECKS_PATH, 'utf8') !== checksMarkdown()) {
    problems.push(
      'gbp-audit/references/checks.md is stale: run plugin/scripts/checks-reference.mjs',
    )
  }
  return problems
}

const problems = lint()
for (const problem of problems) console.error(problem)
if (problems.length > 0) process.exit(1)
console.log('Skills name only tools the bridge exposes.')
