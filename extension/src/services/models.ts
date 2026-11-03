// The AI writers' one model call: a system prompt and a user prompt in, plain text out, with the
// user's own key for Anthropic, OpenAI or Gemini. Called only in the service worker, where the
// vault decrypts the key; no SDK is bundled for one request shape per provider.
import type { SecretName } from '@open-agent-ready/core/secrets'

export type ModelProvider = 'anthropic' | 'openai' | 'gemini'

/** The model each provider writes with; one place, so a model update is one edit. */
export const MODEL_ID: Readonly<Record<ModelProvider, string>> = {
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-5-mini',
  gemini: 'gemini-2.5-flash',
}

export const MODEL_LABEL: Readonly<Record<ModelProvider, string>> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
}

/** Tried in this order; the first key the vault holds writes the draft. */
export const MODEL_SECRET: readonly (readonly [ModelProvider, SecretName])[] = [
  ['anthropic', 'anthropic_key'],
  ['openai', 'openai_key'],
  ['gemini', 'gemini_key'],
]

export interface TextPrompt {
  readonly system: string
  readonly user: string
  /** Room for the answer; drafts are short. */
  readonly maxTokens: number
}

export async function writeText(
  provider: ModelProvider,
  key: string,
  prompt: TextPrompt,
  fetchFn: typeof fetch,
): Promise<string> {
  const request = REQUEST[provider](key, prompt)
  const response = await fetchFn(request.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...request.headers },
    body: JSON.stringify(request.body),
  })
  // The status says enough; a provider's body can echo the request, so it is never shown.
  if (!response.ok) throw new Error(`${MODEL_LABEL[provider]} answered ${response.status}.`)
  const text = TEXT[provider](await response.json())
  if (text === null || text.trim() === '') {
    throw new Error(`${MODEL_LABEL[provider]} returned no text.`)
  }
  return text
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

interface Request {
  readonly url: string
  readonly headers: Record<string, string>
  readonly body: unknown
}

const REQUEST: Readonly<Record<ModelProvider, (key: string, prompt: TextPrompt) => Request>> = {
  anthropic: (key, prompt) => ({
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // The key is the user's own and stays in the service worker; this header is how the API
      // accepts a call from a browser context.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: {
      model: MODEL_ID.anthropic,
      max_tokens: prompt.maxTokens,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    },
  }),
  openai: (key, prompt) => ({
    url: 'https://api.openai.com/v1/responses',
    headers: { authorization: `Bearer ${key}` },
    body: {
      model: MODEL_ID.openai,
      instructions: prompt.system,
      input: prompt.user,
      max_output_tokens: prompt.maxTokens,
      // A draft needs nothing kept on OpenAI's side.
      store: false,
    },
  }),
  gemini: (key, prompt) => ({
    url: `${GEMINI_BASE}/${MODEL_ID.gemini}:generateContent`,
    headers: { 'x-goog-api-key': key },
    body: {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: { maxOutputTokens: prompt.maxTokens },
    },
  }),
}

const TEXT: Readonly<Record<ModelProvider, (body: unknown) => string | null>> = {
  anthropic: (body) => joined((body as { content?: { type?: string; text?: string }[] }).content),
  openai: (body) => {
    const output = (body as { output?: { type?: string; content?: unknown[] }[] }).output ?? []
    const message = output.find((item) => item.type === 'message')
    return joined(message?.content as { type?: string; text?: string }[] | undefined)
  },
  gemini: (body) => {
    const candidates = (body as { candidates?: { content?: { parts?: unknown[] } }[] }).candidates
    return joined(candidates?.[0]?.content?.parts as { text?: string }[] | undefined)
  },
}

function joined(parts: readonly { type?: string; text?: string }[] | undefined): string | null {
  const texts = (parts ?? [])
    .filter(
      (part) => part.type === undefined || part.type === 'text' || part.type === 'output_text',
    )
    .map((part) => part.text ?? '')
  return texts.length === 0 ? null : texts.join('')
}
