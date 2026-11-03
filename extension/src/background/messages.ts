import { isApiRequest, type ApiReply } from '../shared/api'
import { dispatch } from './router'

/** Answers `{ type, payload }` requests from the panel, the report tab and content scripts. */
export function listenForRequests(): void {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isApiRequest(message)) return undefined
    dispatch(message.type, message.payload, sender).then(
      (result) => sendResponse({ ok: true, result } satisfies ApiReply),
      (error: unknown) => sendResponse({ ok: false, error: errorText(error) } satisfies ApiReply),
    )
    return true
  })
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
