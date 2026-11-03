import { describe, expect, it } from 'vitest'
import { writeText, type ModelProvider } from '../../src/services/models'

// Each provider's answer shape, as its API documents it, cut to what the client reads.
const ANSWERS: Readonly<Record<ModelProvider, unknown>> = {
  anthropic: { content: [{ type: 'text', text: 'We fix leaks.' }], stop_reason: 'end_turn' },
  openai: {
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [{ type: 'output_text', text: 'We fix leaks.' }] },
    ],
  },
  gemini: { candidates: [{ content: { parts: [{ text: 'We fix leaks.' }] } }] },
}

const prompt = { system: 'Draft.', user: 'Facts.', maxTokens: 400 }

describe('model calls for the AI writers', () => {
  for (const provider of ['anthropic', 'openai', 'gemini'] as const) {
    it(`reads ${provider}'s text, sending the key only in its auth header`, async () => {
      let sent: RequestInit | undefined
      const fetchFn = (async (_url: string, init?: RequestInit) => {
        sent = init
        return new Response(JSON.stringify(ANSWERS[provider]))
      }) as typeof fetch
      expect(await writeText(provider, 'sk-secret', prompt, fetchFn)).toBe('We fix leaks.')
      expect(String(sent?.body)).not.toContain('sk-secret')
      expect(JSON.stringify(sent?.headers)).toContain('sk-secret')
    })
  }

  it('says which provider refused, without its body', async () => {
    const fetchFn = (async () =>
      new Response('{"error":"bad key sk-secret"}', { status: 401 })) as typeof fetch
    await expect(writeText('openai', 'sk-secret', prompt, fetchFn)).rejects.toThrow(
      /^OpenAI answered 401\.$/,
    )
  })
})
