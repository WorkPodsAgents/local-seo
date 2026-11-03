// Every check this module emits, in registry order, with its funnel layer and checklist group, so
// the UI can list a check even when it passes.
import type { CheckGroup, Evidence, Finding, Layer, Status } from '../model'
import { check } from '../registry'
import type { Severity } from '../registry'

export interface PageCheck {
  readonly id: string
  readonly layer: Layer
  readonly group: CheckGroup
}

export const PAGE_CHECKS: readonly PageCheck[] = [
  { id: 'AX2', layer: 'axo', group: 'ai_readiness' },
  { id: 'missing_organization_identity', layer: 'geo', group: 'ai_readiness' },
  { id: 'missing_title', layer: 'seo', group: 'title_meta' },
  { id: 'title_too_long', layer: 'seo', group: 'title_meta' },
  { id: 'title_too_short', layer: 'seo', group: 'title_meta' },
  { id: 'missing_meta_description', layer: 'seo', group: 'title_meta' },
  { id: 'missing_h1', layer: 'seo', group: 'headings_content' },
  { id: 'multiple_h1', layer: 'seo', group: 'headings_content' },
  { id: 'thin_content', layer: 'seo', group: 'headings_content' },
  { id: 'non_200_status', layer: 'seo', group: 'indexing' },
  { id: 'redirect_chain', layer: 'seo', group: 'indexing' },
  { id: 'canonical_mismatch', layer: 'seo', group: 'indexing' },
  { id: 'noindex', layer: 'seo', group: 'indexing' },
  { id: 'blocked_by_robots', layer: 'seo', group: 'indexing' },
  { id: 'missing_schema', layer: 'seo', group: 'structured_media' },
  { id: 'missing_alt_text', layer: 'seo', group: 'structured_media' },
  { id: 'slow_lcp', layer: 'seo', group: 'speed' },
  { id: 'poor_cls', layer: 'seo', group: 'speed' },
  { id: 'invalid_schema', layer: 'seo', group: 'structured_media' },
  { id: 'missing_canonical', layer: 'seo', group: 'indexing' },
  { id: 'redirect_loop', layer: 'seo', group: 'indexing' },
  { id: 'internal_nofollow', layer: 'seo', group: 'links' },
  { id: 'hreflang_invalid_code', layer: 'seo', group: 'international' },
  { id: 'mixed_content', layer: 'seo', group: 'structured_media' },
  { id: 'ai_content_requires_js', layer: 'geo', group: 'ai_readiness' },
  { id: 'schema_requires_js', layer: 'geo', group: 'structured_media' },
  { id: 'ai_crawler_blocked', layer: 'geo', group: 'ai_readiness' },
  { id: 'browser_redirect', layer: 'seo', group: 'indexing' },
  { id: 'schema_properties_missing', layer: 'axo', group: 'ai_readiness' },
  { id: 'webmcp_tool_incomplete', layer: 'axo', group: 'ai_readiness' },
  { id: 'controls_unlabelled', layer: 'axo', group: 'ai_readiness' },
]

const BY_ID: ReadonlyMap<string, PageCheck> = new Map(PAGE_CHECKS.map((entry) => [entry.id, entry]))

/** Findings cite at most this many elements; the summary carries the full count. */
export const EVIDENCE_LIMIT = 20

/**
 * A finding of check `id`. Its severity is the registry default unless the WorkPods rule grades
 * it, and null on pass and not applicable.
 */
export function finding(
  id: string,
  status: Status,
  summary: string,
  evidence: readonly Evidence[] = [],
  severity?: Severity,
): Finding {
  const entry = BY_ID.get(id)
  if (entry === undefined) throw new Error(`not a page check: ${id}`)
  const fired = status === 'fail' || status === 'partial'
  return {
    checkId: id,
    layer: entry.layer,
    group: entry.group,
    status,
    severity: fired ? (severity ?? check(id).defaultSeverity) : null,
    summary,
    evidence: evidence.slice(0, EVIDENCE_LIMIT),
  }
}

/** "1 image" or "3 images". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "2 of 5 images are", so a summary reads as a sentence. */
export function someOf(n: number, total: number, one: string, many = `${one}s`): string {
  return `${n} of ${count(total, one, many)} ${are(n)}`
}

/** "is" for one, "are" for more. */
export function are(n: number): string {
  return n === 1 ? 'is' : 'are'
}
