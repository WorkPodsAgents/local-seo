// Assist mode on the engine's page: put the prompt in the input box, then wait for the answer the
// user asked for. Sending stays with the user: nothing here presses Enter or clicks send.
import type { EngineAdapter, ReadAnswer } from './engines'

/** Writes `text` into a textarea, an input or a rich-text editor, as typing would. */
export function fillPrompt(input: HTMLElement, text: string): void {
  // Events are built from the input's own window, the realm its listeners expect.
  const view = input.ownerDocument.defaultView ?? window
  input.focus()
  if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
    // React-controlled boxes ignore a plain assignment; the prototype setter updates their state.
    const proto = Object.getPrototypeOf(input) as object
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter === undefined) (input as HTMLTextAreaElement).value = text
    else setter.call(input, text)
    input.dispatchEvent(new view.Event('input', { bubbles: true }))
    return
  }
  // Rich editors (ProseMirror, Quill) keep their own model and listen for beforeinput or
  // execCommand; replacing the text node directly would leave the engine sending the old text.
  const selection = input.ownerDocument.getSelection()
  selection?.selectAllChildren(input)
  const inserted = input.ownerDocument.execCommand?.('insertText', false, text) ?? false
  if (!inserted) {
    input.textContent = text
    input.dispatchEvent(new view.InputEvent('input', { bubbles: true, data: text }))
  }
}

export interface AwaitOptions {
  /** The answer text on the page before the user sent the prompt, so it is not read again. */
  readonly before: string | null
  /** How long the text must stay unchanged once the engine stops writing. */
  readonly quietMs: number
  readonly timeoutMs: number
  readonly pollMs: number
  readonly sleep: (ms: number) => Promise<void>
}

/**
 * Resolves with the new answer once it has finished streaming and stopped changing, or null when
 * none arrives in time (the user never pressed Enter, or the engine failed).
 */
export async function awaitAnswer(
  doc: Document,
  adapter: EngineAdapter,
  pageUrl: () => string,
  options: AwaitOptions,
): Promise<ReadAnswer | null> {
  let last: string | null = null
  let stableFor = 0
  for (let waited = 0; waited <= options.timeoutMs; waited += options.pollMs) {
    const answer = adapter.read(doc, pageUrl())
    const fresh = answer !== null && answer.text.length > 0 && answer.text !== options.before
    if (fresh && !answer.streaming && answer.text === last) {
      stableFor += options.pollMs
      if (stableFor >= options.quietMs) return answer
    } else {
      stableFor = 0
    }
    last = answer?.text ?? null
    await options.sleep(options.pollMs)
  }
  return null
}
