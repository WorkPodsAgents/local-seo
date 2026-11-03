// Checks an llms.txt against llmstxt.org, ported from WorkPods LlmsTxt.kt: an H1 naming the site,
// opening the file, is the only required element. The H1 is read as CommonMark reads one (an ATX
// heading indented at most three spaces, or a setext heading); front matter and HTML comments
// before it are skipped.
import type { FileProblem } from './file-problem'

const ATX_H1 = /^ {0,3}#[ \t]+\S.*$/
const SETEXT_H1 = /^ {0,3}=+[ \t]*$/
const CODE = /^( {4}|\t)/
const FRONT_MATTER = '---'
const BOM = '﻿'

export function llmsTxtProblems(text: string): FileProblem[] {
  const body = text.startsWith(BOM) ? text.slice(1) : text
  return opensWithH1(body.split(/\r\n|\r|\n/)) ? [] : [{ code: 'missing_h1', field: null }]
}

function opensWithH1(lines: readonly string[]): boolean {
  const start = skipPreamble(lines)
  const block: string[] = []
  for (const line of lines.slice(start)) {
    if (line.trim() === '') break
    block.push(line)
  }
  const first = block[0]
  if (first === undefined) return false
  const second = block[1]
  const setext = second !== undefined && SETEXT_H1.test(second) && !CODE.test(first)
  return ATX_H1.test(first) || setext
}

/** The index of the first line after blank lines, front matter and comments. */
function skipPreamble(lines: readonly string[]): number {
  let i = 0
  let moved = true
  while (moved && i < lines.length) {
    const start = i
    while (i < lines.length && (lines[i] ?? '').trim() === '') i++
    if (i === 0 && lines[0]?.trim() === FRONT_MATTER) {
      i = closing(lines, 1, (line) => line.trim() === FRONT_MATTER || line.trim() === '...')
    } else if (lines[i]?.trimStart().startsWith('<!--') === true) {
      i = closing(lines, i, (line) => line.includes('-->'))
    }
    moved = i !== start
  }
  return i
}

/** The line after the first from `from` that `ends`; the end when none does. */
function closing(lines: readonly string[], from: number, ends: (line: string) => boolean): number {
  for (let i = from; i < lines.length; i++) if (ends(lines[i] ?? '')) return i + 1
  return lines.length
}
