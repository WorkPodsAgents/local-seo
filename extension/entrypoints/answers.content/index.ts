import { awaitAnswer, fillPrompt } from '../../src/answers/assist'
import { engineFor } from '../../src/answers/engines'
import { isAnswerMessage } from '../../src/answers/messages'

/** How long the answer must stay unchanged after the assistant stops writing. */
const QUIET_MS = 1500
const POLL_MS = 500

const INSTALLED = Symbol.for('local-seo.answers')

// Reads AI answers in the user's own session, injected only into assistants the user allowed and
// only when asked. It fills the prompt box and waits; it never presses Enter or clicks send.
export default defineContentScript({
  registration: 'runtime',
  main() {
    const scope = globalThis as { [INSTALLED]?: true }
    // Every request injects the script first, so a second injection must not listen twice.
    if (scope[INSTALLED]) return
    scope[INSTALLED] = true
    const pageUrl = () => location.href
    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      const adapter = engineFor(pageUrl())
      if (adapter === null) return undefined
      if (isAnswerMessage(message, 'answers:fill')) {
        const input = adapter.promptInput(document)
        const before = adapter.read(document, pageUrl())?.text ?? null
        if (input !== null) fillPrompt(input, message.payload.prompt)
        sendResponse({ filled: input !== null, before })
        return undefined
      }
      if (isAnswerMessage(message, 'answers:await')) {
        void awaitAnswer(document, adapter, pageUrl, {
          before: message.payload.before,
          quietMs: QUIET_MS,
          timeoutMs: message.payload.timeoutMs,
          pollMs: POLL_MS,
          sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        }).then(sendResponse)
        // Keeps the channel open until the answer arrives.
        return true
      }
      return undefined
    })
  },
})
