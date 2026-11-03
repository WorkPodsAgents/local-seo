// Assist mode from the service worker: open the assistant in a tab of the user's own signed-in
// browser, fill in the prompt, and wait while the user reads it and presses Enter. The extension
// never sends a prompt itself. The tab stays open afterwards; it is the user's conversation.
import { originPattern } from '../background/host-access'
import { ENGINE_HOME, ENGINE_LABEL, type EngineId, type ReadAnswer } from './engines'
import type { AnswerMessageType, AnswerMessages } from './messages'

const SCRIPT = '/content-scripts/answers.js'
const LOAD_TIMEOUT_MS = 20_000
const POLL_MS = 500
/** Assistants that browse first take a while; the user also has to notice the tab. */
export const ASSIST_TIMEOUT_MS = 5 * 60_000

export type AssistRead =
  | { readonly kind: 'answer'; readonly answer: ReadAnswer }
  | { readonly kind: 'missing'; readonly reason: string }

/** Opens `engine` with `prompt` filled in and returns the answer once the user has sent it. */
export async function assistInTab(
  engine: EngineId,
  prompt: string,
  focus: boolean,
): Promise<AssistRead> {
  const home = ENGINE_HOME[engine]
  const name = ENGINE_LABEL[engine]
  if (!(await browser.permissions.contains({ origins: [originPattern(home)] }))) {
    return {
      kind: 'missing',
      reason: `Local SEO may not read ${name} yet. Allow it in the side panel's AI answers card.`,
    }
  }
  const tab = await browser.tabs.create({ url: home, active: focus })
  if (tab.id === undefined) return { kind: 'missing', reason: `Chrome did not open ${name}.` }
  const tabId = tab.id
  if (!(await loaded(tabId))) return { kind: 'missing', reason: `${name} did not load in time.` }
  try {
    const filled = await ask(tabId, 'answers:fill', { prompt })
    if (!filled.filled) {
      return {
        kind: 'missing',
        reason: `${name} showed no prompt box. You may need to sign in to ${name} first.`,
      }
    }
    const answer = await ask(tabId, 'answers:await', {
      before: filled.before,
      timeoutMs: ASSIST_TIMEOUT_MS,
    })
    if (answer === null) {
      return {
        kind: 'missing',
        reason: `Nobody sent the prompt in ${name} within 5 minutes, so there is no answer.`,
      }
    }
    return { kind: 'answer', answer }
  } catch (error) {
    return { kind: 'missing', reason: error instanceof Error ? error.message : String(error) }
  }
}

async function ask<T extends AnswerMessageType>(
  tabId: number,
  type: T,
  payload: AnswerMessages[T]['request'],
): Promise<AnswerMessages[T]['response']> {
  await browser.scripting.executeScript({ target: { tabId }, files: [SCRIPT] })
  return (await browser.tabs.sendMessage(tabId, { type, payload })) as AnswerMessages[T]['response']
}

async function loaded(tabId: number): Promise<boolean> {
  for (let waited = 0; waited < LOAD_TIMEOUT_MS; waited += POLL_MS) {
    const tab = await browser.tabs.get(tabId).catch(() => null)
    if (tab === null) return false
    if (tab.status === 'complete') return true
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  return false
}
