// How a file read ended, ported from WorkPods ResourceFetch and BlockedResponse: a refusal (a 403,
// a 429 or a bot challenge) says nothing about the file, while a 404 or 410 says it is absent.
import type { FileAnswer } from './fetch-file'

export type FileOutcome = 'ok' | 'not_found' | 'blocked' | 'failed'

const CHALLENGE_MARKERS = [
  'cf-chl-',
  'challenge-platform',
  '<title>just a moment...</title>',
  'attention required! | cloudflare',
  '_incapsula_resource',
  'px-captcha',
  'g-recaptcha',
  'h-captcha',
]
const SAMPLE = 64 * 1024

export function outcomeOf(answer: FileAnswer): FileOutcome {
  const response = answer.response
  if (response === null) return 'failed'
  const head = response.body.slice(0, SAMPLE).toLowerCase()
  const challenged = CHALLENGE_MARKERS.some((marker) => head.includes(marker))
  if (response.status === 403 || response.status === 429 || challenged) return 'blocked'
  if (response.status === 404 || response.status === 410) return 'not_found'
  if (response.status < 200 || response.status >= 300) return 'failed'
  return 'ok'
}
