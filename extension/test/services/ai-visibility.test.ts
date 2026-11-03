// local_ai_visibility as an agent calls it: free Assist mode by default, Cloro only when asked,
// priced first and refused over the cap.
import { describe, expect, it } from 'vitest'
import type { AnswerDeps } from '../../src/answers/visibility'
import { createLocalTools } from '../../src/services/tools'
import { FakeMaps, fakeDeps } from './fakes'

const ARGS = { query: 'dentist', city: 'Austin, TX', businessName: 'South Austin Dentist' }
const named = {
  kind: 'answer',
  answer: { text: '1. South Austin Dentist', citedUrls: [] },
} as const

function tools(paidBlock: string | null = null) {
  const asked: string[] = []
  const answers = async (source: string): Promise<AnswerDeps> => ({
    assist: async (engine) => (asked.push(`${source}:assist:${engine}`), named),
    cloro: source === 'cloro' ? async (engine) => (asked.push(`cloro:${engine}`), named) : null,
  })
  const deps = fakeDeps(new FakeMaps(() => ({})), {
    answers,
    paidBlock: async () => paidBlock,
  })
  return { asked, tools: createLocalTools(deps) }
}

describe('asking AI assistants about a local business', () => {
  it('given no source, then every engine is asked in the browser for free', async () => {
    const { asked, tools: local } = tools()
    const result = await local.local_ai_visibility({ ...ARGS, engines: ['chatgpt', 'gemini'] })
    expect(result).toMatchObject({ source: 'assist', estimatedCostUsd: null })
    expect(asked).toEqual(['assist:assist:chatgpt', 'assist:assist:gemini'])
    expect(result.answers.map((entry) => entry.engine)).toEqual(['chatgpt', 'gemini'])
  })

  it('given cloro and estimateOnly, then the price comes back and nothing is asked', async () => {
    const { asked, tools: local } = tools()
    const result = await local.local_ai_visibility({
      ...ARGS,
      source: 'cloro',
      engines: ['chatgpt', 'ai_mode', 'perplexity'],
      estimateOnly: true,
    })
    expect(result.answers).toEqual([])
    expect(result.estimatedCostUsd).toBeCloseTo(0.026, 6)
    expect(asked).toEqual([])
  })

  it('given cloro over the cap, then nothing is asked and the cap is the reason', async () => {
    const { asked, tools: local } = tools('This costs about $0.04; $0.01 is left.')
    await expect(local.local_ai_visibility({ ...ARGS, source: 'cloro' })).rejects.toThrow(
      '$0.01 is left',
    )
    expect(asked).toEqual([])
  })

  it('given cloro within the cap, then Cloro asks; Perplexity stays in the browser', async () => {
    const { asked, tools: local } = tools()
    const result = await local.local_ai_visibility({ ...ARGS, source: 'cloro' })
    expect(result.source).toBe('cloro')
    expect(asked.sort()).toEqual(
      ['cloro:ai_mode', 'cloro:assist:perplexity', 'cloro:chatgpt', 'cloro:gemini'].sort(),
    )
  })
})
