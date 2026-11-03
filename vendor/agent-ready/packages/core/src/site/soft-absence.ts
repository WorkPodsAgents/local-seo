// Tells a file a site serves from an answer that only stands in for a missing one, ported from
// WorkPods SoftAbsence.kt, so an absent optional file is never judged broken. Runs on a 2xx answer
// after refusals were set aside, in this order: an HTML page, an empty body, a redirect to the
// site's root or home page, a non-JSON answer on a .json path, a short llms.txt that is plainly a
// not-found message, an ai-plugin.json without the two fields every one carries, and a JSON
// not-found answer with none of a manifest's required fields.
import type { FetchResponse } from '../io'
import { parseObject, REQUIRED_FIELDS } from './agent-manifests'
import { mediaType } from './fetch-file'

export type AgentFileKind =
  'llms_txt' | 'ai_catalog' | 'mcp_server_card' | 'a2a_agent_card' | 'ai_plugin'

export type AbsenceReason =
  | 'html_answer'
  | 'empty_answer'
  | 'redirected_elsewhere'
  | 'not_json_answer'
  | 'not_found_message'
  | 'not_ai_plugin'
  | 'not_found_json'

const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml'])
const NOT_FOUND_MARKER = /\b404\b|not found/i
const NOT_FOUND_WORDS =
  /\b(404|not found|page not found|file not found|does not exist|no such file)\b/i
const SHORT = 200
const HEAD = 64

/** Why the answer at `landed` for `requested` is no file; null when it is one. */
export function absenceReason(
  kind: AgentFileKind,
  requested: string,
  landed: string,
  response: FetchResponse,
  /** Where the site's home page lands, a redirect there being absence. */
  home: string,
): AbsenceReason | null {
  const text = response.body.replace(/^﻿/, '').trim()
  const type = mediaType(response)
  const path = pathOf(requested)
  if (html(type, text)) return 'html_answer'
  if (text === '') return 'empty_answer'
  if (redirectedHome(path, pathOf(landed), pathOf(home))) return 'redirected_elsewhere'
  if (path.endsWith('.json') && !json(type) && !parseable(text)) return 'not_json_answer'
  if (kind === 'llms_txt' && notFoundMessage(text)) return 'not_found_message'
  if (kind === 'ai_plugin' && !aiPlugin(text)) return 'not_ai_plugin'
  if (jsonNotFound(kind, text)) return 'not_found_json'
  return null
}

function html(type: string | null, text: string): boolean {
  const head = text.slice(0, HEAD).toLowerCase()
  return (
    (type !== null && HTML_TYPES.has(type)) ||
    head.startsWith('<!doctype') ||
    head.startsWith('<html')
  )
}

function json(type: string | null): boolean {
  return type === 'application/json' || type?.endsWith('+json') === true
}

function parseable(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

function redirectedHome(path: string, landed: string, home: string): boolean {
  return landed !== path && (landed === '/' || landed === home)
}

/** A short body with no heading that says not found: a terse but real llms.txt is still judged. */
function notFoundMessage(text: string): boolean {
  return text.length <= SHORT && !text.startsWith('#') && NOT_FOUND_WORDS.test(text)
}

/** OpenAI's retired plugin manifest always carried schema_version and name_for_model. */
function aiPlugin(text: string): boolean {
  const root = parseObject(text)
  return root !== null && 'schema_version' in root && 'name_for_model' in root
}

/**
 * An API's not-found answer: a JSON object with none of the manifest's required fields whose
 * error, message or status holds 404 or "not found". A manifest with its fields stays present,
 * however broken.
 */
function jsonNotFound(kind: AgentFileKind, text: string): boolean {
  if (kind !== 'ai_catalog' && kind !== 'mcp_server_card' && kind !== 'a2a_agent_card') {
    return false
  }
  const root = parseObject(text)
  if (root === null) return false
  if (REQUIRED_FIELDS[kind].some((field) => field in root)) return false
  return ['error', 'message', 'status'].some((key) => {
    const value = root[key]
    return value !== undefined && NOT_FOUND_MARKER.test(JSON.stringify(value))
  })
}

function pathOf(url: string): string {
  try {
    const path = new URL(url).pathname
    return path === '' ? '/' : path
  } catch {
    return url
  }
}
