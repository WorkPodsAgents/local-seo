// Core Web Vitals from the live tab. WorkPods fires over the good bound; here a reading between
// the good and poor bounds is partial and one past the poor bound fails, so the two stay apart.
import type { Finding, Vitals } from '../model'
import { threshold } from '../registry'
import { finding } from './page-checks'

export function speedChecks(vitals: Vitals | null): Finding[] {
  return [lcpCheck(vitals?.lcpMs ?? null), clsCheck(vitals?.cls ?? null)]
}

function lcpCheck(lcp: number | null): Finding {
  if (lcp === null) return finding('slow_lcp', 'not_applicable', 'The browser did not measure LCP.')
  const good = seconds(threshold('core_web_vitals.lcp.good'))
  const summary = `LCP is ${seconds(lcp)}; good is ${good} or less.`
  const evidence = [{ value: `${Math.round(lcp)} ms` }]
  return finding('slow_lcp', band(lcp, 'core_web_vitals.lcp'), summary, evidence)
}

function clsCheck(cls: number | null): Finding {
  if (cls === null) return finding('poor_cls', 'not_applicable', 'The browser did not measure CLS.')
  const good = threshold('core_web_vitals.cls.good')
  const summary = `CLS is ${cls.toFixed(2)}; good is ${good} or less.`
  return finding('poor_cls', band(cls, 'core_web_vitals.cls'), summary, [{ value: String(cls) }])
}

function band(value: number, metric: string): 'pass' | 'partial' | 'fail' {
  if (value > threshold(`${metric}.poor`)) return 'fail'
  return value > threshold(`${metric}.good`) ? 'partial' : 'pass'
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`
}
