import type { ApiReply } from '../shared/api'
import type { OffscreenOp, OffscreenOps } from '../shared/offscreen'

let creating: Promise<void> | null = null

/** Runs one parsing job in the offscreen document, creating the document on first use. */
export async function offscreen<K extends OffscreenOp>(
  op: K,
  input: OffscreenOps[K]['in'],
): Promise<OffscreenOps[K]['out']> {
  if (import.meta.env.FIREFOX) {
    const { OPS } = await import('../offscreen/serve')
    const operation = OPS[op] as (value: OffscreenOps[K]['in']) => Promise<OffscreenOps[K]['out']>
    return operation(input)
  }
  await ensureDocument()
  const reply = (await browser.runtime.sendMessage({ target: 'offscreen', op, input })) as ApiReply
  if (!reply.ok) throw new Error(reply.error)
  // The offscreen document answers each op from the same OffscreenOps map.
  return reply.result as OffscreenOps[K]['out']
}

async function ensureDocument(): Promise<void> {
  if (await browser.offscreen.hasDocument()) return
  // Two jobs can start at once; the second waits for the first creation instead of failing.
  creating ??= browser.offscreen
    .createDocument({
      url: '/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: "Parse a business's website to compare it with its Google profile.",
    })
    .finally(() => {
      creating = null
    })
  await creating
}
