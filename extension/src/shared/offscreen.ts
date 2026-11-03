// The website check needs a parsed Document and a service worker has no DOMParser, so the check
// runs in an offscreen document and only plain JSON comes back. Its requests come back to the
// service worker (`net:fetch`), which alone can see redirect hops.
import type { Business } from '@local-seo/core/business'
import type { WebsiteRead } from '../services/deps'

export interface OffscreenOps {
  website: { in: { business: Business; url: string }; out: WebsiteRead }
}

export type OffscreenOp = keyof OffscreenOps

export interface OffscreenCall {
  readonly target: 'offscreen'
  readonly op: OffscreenOp
  readonly input: unknown
}

export function isOffscreenCall(message: unknown): message is OffscreenCall {
  return (
    typeof message === 'object' &&
    message !== null &&
    'target' in message &&
    message.target === 'offscreen'
  )
}
