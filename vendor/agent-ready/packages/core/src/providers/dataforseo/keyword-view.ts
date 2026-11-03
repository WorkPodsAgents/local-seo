// A keyword's difficulty next to the strength of the domains that hold its top 10. Labs keyword
// difficulty models page-level links, and service pages on strong domains have few links, so a KD
// under 30 can sit on a SERP held by domains ranked 30 to 70. A keyword is called easy only when
// its top 10 agrees.
import type { KeywordMetrics, SerpResult } from './keywords'

/**
 * - easy: KD under 30 and fewer than three strong domains in the top 10;
 * - kd_understates: KD under 30, but three or more strong domains hold the top 10;
 * - possible: KD 30 to 69; hard: KD 70 or more;
 * - unchecked: KD under 30 and no domain rank is known for the top 10;
 * - unknown: no KD reported.
 */
export type KeywordVerdict =
  'easy' | 'kd_understates' | 'possible' | 'hard' | 'unchecked' | 'unknown'

export interface KeywordView extends KeywordMetrics {
  readonly top10: readonly SerpResult[]
  /** The median domain rank of the top 10, over the ranks known; null when none is. */
  readonly medianDomainRank: number | null
  /** Top-10 domains stronger than the user's (or ranked 30 or more when the user's is unknown). */
  readonly strongDomains: number
  readonly verdict: KeywordVerdict
}

const EASY_KD = 30
const HARD_KD = 70
/** The domain rank from which a top-10 domain counts as strong when the user's is unknown. */
const STRONG_RANK = 30
const STRONG_COUNT = 3

export function keywordView(
  metrics: KeywordMetrics,
  top10: readonly SerpResult[],
  ownDomainRank: number | null = null,
): KeywordView {
  const ranks = top10.flatMap((result) => (result.domainRank === null ? [] : [result.domainRank]))
  const strong = (rank: number) =>
    ownDomainRank === null ? rank >= STRONG_RANK : rank > ownDomainRank
  const strongDomains = ranks.filter(strong).length
  return {
    ...metrics,
    top10,
    medianDomainRank: median(ranks),
    strongDomains,
    verdict: verdictOf(metrics.keywordDifficulty, ranks.length, strongDomains),
  }
}

function verdictOf(kd: number | null, known: number, strong: number): KeywordVerdict {
  if (kd === null) return 'unknown'
  if (kd >= HARD_KD) return 'hard'
  if (kd >= EASY_KD) return 'possible'
  if (known === 0) return 'unchecked'
  return strong >= STRONG_COUNT ? 'kd_understates' : 'easy'
}

function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle]
  if (upper === undefined) return null
  const lower = sorted[middle - 1]
  return sorted.length % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2
}
